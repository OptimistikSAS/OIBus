import fs from 'node:fs/promises';
import path from 'node:path';

import { DateTime } from 'luxon';
import {
  AggregateFunction,
  ClientSession,
  DataType,
  DataValue,
  HistoryReadRequest,
  InMemoryCertificateStore,
  OPCUAClient,
  OPCUAClientOptions,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  TimestampsToReturn,
  UserIdentityInfo,
  UserTokenType,
  Variant
} from 'node-opcua';
import { convertPEMtoDER, exploreCertificate } from 'node-opcua-crypto';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';

import { Instant } from '../../shared/model/common/types';
import {
  NorthOPCUASettings,
  NorthOPCUASettingsSecurityMode,
  NorthOPCUASettingsSecurityPolicy
} from '../../shared/model/connector/north-settings.model';
import {
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOPCUASettingsSecurityMode,
  SouthOPCUASettingsSecurityPolicy
} from '../../shared/model/connector/south-settings.model';

import type { ILogger } from '../model/logger.model';
import { encryptionService } from './encryption.service';

const NUM_VALUES_PER_NODE = 1000;
export const MAX_NUMBER_OF_NODE_TO_LOG = 10;

export const toOPCUASecurityMode = (securityMode: SouthOPCUASettingsSecurityMode | NorthOPCUASettingsSecurityMode): number => {
  switch (securityMode) {
    case 'none':
      return 1;
    case 'sign':
      return 2;
    case 'sign-and-encrypt':
      return 3;
  }
};

export const toOPCUASecurityPolicy = (
  securityPolicy: SouthOPCUASettingsSecurityPolicy | NorthOPCUASettingsSecurityPolicy | null | undefined
): string | undefined => {
  switch (securityPolicy) {
    case 'none':
      return 'none';
    case 'basic128':
      return 'Basic128';
    case 'basic192':
      return 'Basic192';
    case 'basic256':
      return 'Basic256';
    case 'basic128-rsa15':
      return 'Basic128Rsa15';
    case 'basic192-rsa15':
      return 'Basic192Rsa15';
    case 'basic256-rsa15':
      return 'Basic256Rsa15';
    case 'basic256-sha256':
      return 'Basic256Sha256';
    case 'aes128-sha256-rsa-oaep':
      return 'Aes128_Sha256_RsaOaep';
    case 'pub-sub-aes-128-ctr':
      return 'PubSub_Aes128_CTR';
    case 'pub-sub-aes-256-ctr':
      return 'PubSub_Aes256_CTR';
    default:
      return undefined;
  }
};

/**
 * Read OIBus's certificate from disk and extract its applicationUri (the URN embedded
 * in subjectAltName when the cert was generated). We pass this explicitly to OPCUAClient
 * so it matches the cert — otherwise node-opcua auto-builds `urn:<hostname>:OIBus`,
 * which mismatches the cert on portable / virtualised installs and triggers W06.
 */
export const getOPCUAApplicationUri = async (): Promise<string | undefined> => {
  try {
    const certPem = await fs.readFile(encryptionService.getCertPath(), 'utf8');
    const info = exploreCertificate(convertPEMtoDER(certPem));
    return info.tbsCertificate.extensions?.subjectAltName?.uniformResourceIdentifier?.[0];
  } catch {
    // If the cert can't be parsed, fall back to node-opcua's hostname-derived default.
    return undefined;
  }
};

export const createSessionConfigs = async (
  connectorId: string,
  connectorName: string,
  settings: SouthOPCUASettings | NorthOPCUASettings,
  requestTimeout: number
) => {
  const options: OPCUAClientOptions = {
    applicationName: 'OIBus',
    // applicationUri must match the cert's subjectAltName URI (W06 warning + handshake rejection).
    applicationUri: await getOPCUAApplicationUri(),
    connectionStrategy: {
      initialDelay: 1000,
      maxRetry: 1
    },
    securityMode: toOPCUASecurityMode(settings.securityMode),
    securityPolicy: toOPCUASecurityPolicy(settings.securityPolicy),
    endpointMustExist: false,
    keepSessionAlive: settings.keepSessionAlive,
    // Bounds the TCP connection and the OPC-UA handshake (HEL/ACK) of each connection attempt, see createOPCUASession for the whole connection
    transportTimeout: settings.connectionTimeout,
    // How long a request (read, history read, browse, write...) waits for its response. The session timeout is left to the node-opcua
    // default: it is how long the server keeps an idle session, which has nothing to do with the duration of one request
    defaultTransactionTimeout: requestTimeout,
    keepPendingSessionsOnDisconnect: false,
    clientName: `${connectorName}-${connectorId}`,
    // Use OIBus's existing cert/key files directly — no PKI folder tree on disk, no copies.
    // We do NOT use `certificateKeyPairProvider` because node-opcua-client's findEndpoint
    // helper (used internally for endpoint discovery) doesn't propagate that option to its
    // internal TmpClient. Disk paths get correctly forwarded and re-read by TmpClient.
    certificateFile: encryptionService.getCertPath(),
    privateKeyFile: encryptionService.getPrivateKeyPath(),
    // In-memory trust store with auto-accept — no rejected/, trusted/, issuers/ folders on disk.
    clientCertificateManager: new InMemoryCertificateStore({ autoAcceptUnknown: true })
  };

  let userIdentity: UserIdentityInfo;
  switch (settings.authentication.type) {
    case 'basic':
      userIdentity = {
        type: UserTokenType.UserName,
        userName: settings.authentication.username!,
        password: await encryptionService.decryptText(settings.authentication.password!)
      };
      break;
    case 'cert':
      const certContent = await fs.readFile(path.resolve(settings.authentication.certFilePath!));
      const privateKeyContent = await fs.readFile(path.resolve(settings.authentication.keyFilePath!));
      userIdentity = {
        type: UserTokenType.Certificate,
        certificateData: certContent,
        privateKey: privateKeyContent.toString('utf8')
      };
      break;
    default:
      userIdentity = { type: UserTokenType.Anonymous };
  }

  return { options, userIdentity };
};

/**
 * Runs `task` and rejects with `message` when it is not done after `timeoutMs`. Wired through a single promise settled by
 * either branch, instead of a `Promise.race`, so that neither branch is left pending once the other one settled (see
 * `getDAValues` of the OPC UA South connector). The task itself is not aborted: the caller has to clean up after a timeout.
 */
const withTimeout = <T>(task: () => Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    task().then(
      result => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });

/**
 * Same as node-opcua's `OPCUAClient.createSession(endpointUrl, userIdentity, options)` - connect a client,
 * open a session on it, and disconnect that client when the session is closed - except that the client
 * is also disconnected when connecting or creating the session fails. node-opcua's static helper leaves
 * the client connected in that case (e.g. a rejected user or certificate): nothing references it anymore,
 * so it can never be closed and keeps reconnecting to the server in the background for the lifetime of
 * the process, silently - while every later attempt opens yet another one.
 *
 * The whole connection (client connection with its retries, secure channel, session creation and activation) is bounded by
 * `connectionTimeout`: node-opcua only bounds each step, so an unreachable or slow server could otherwise keep the
 * connector connecting for much longer.
 */
export const createOPCUASession = async (
  endpointUrl: string,
  userIdentity: UserIdentityInfo,
  options: OPCUAClientOptions,
  connectionTimeout: number
): Promise<ClientSession> => {
  const client = OPCUAClient.create(options);
  let session: ClientSession;
  try {
    const connect = async () => {
      await client.connect(endpointUrl);
      return await client.createSession2(userIdentity);
    };
    session = await withTimeout(connect, connectionTimeout, `Connection timeout: not connected after ${connectionTimeout} ms`);
  } catch (error: unknown) {
    await client.disconnect().catch(() => {
      /* already broken - the original error is the one worth reporting */
    });
    throw error;
  }
  const closeSession = session.close.bind(session) as (deleteSubscriptions?: boolean) => Promise<void>;
  // Only the promise form of close() is used in OIBus - no callback overload to forward.
  session.close = (async (deleteSubscriptions?: boolean) => {
    try {
      await closeSession(deleteSubscriptions ?? true);
    } finally {
      await client.disconnect();
    }
  }) as ClientSession['close'];
  return session;
};

export const getHistoryReadRequest = (
  startTime: Instant,
  endTime: Instant,
  aggregate: string,
  resampling: string | undefined,
  nodesToRead: Array<HistoryReadValueIdOptions>
): HistoryReadRequest => {
  let historyReadDetails: ReadRawModifiedDetails | ReadProcessedDetails;
  switch (aggregate) {
    case 'average':
      historyReadDetails = new ReadProcessedDetails({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Average),
        processingInterval: getResamplingValue(resampling)
      });
      break;
    case 'minimum':
      historyReadDetails = new ReadProcessedDetails({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Minimum),
        processingInterval: getResamplingValue(resampling)
      });
      break;
    case 'maximum':
      historyReadDetails = new ReadProcessedDetails({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Maximum),
        processingInterval: getResamplingValue(resampling)
      });
      break;
    case 'count':
      historyReadDetails = new ReadProcessedDetails({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        aggregateType: Array(nodesToRead.length).fill(AggregateFunction.Count),
        processingInterval: getResamplingValue(resampling)
      });
      break;
    case 'raw':
    default:
      historyReadDetails = new ReadRawModifiedDetails({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isReadModified: false,
        returnBounds: false,
        numValuesPerNode: NUM_VALUES_PER_NODE
      });
      break;
  }
  return new HistoryReadRequest({
    historyReadDetails,
    nodesToRead,
    releaseContinuationPoints: false,
    timestampsToReturn: TimestampsToReturn.Both
  });
};

export const getResamplingValue = (resampling: string | undefined): number | undefined => {
  switch (resampling) {
    case '1s':
      return 1000;
    case '10s':
      return 1000 * 10;
    case '30s':
      return 1000 * 30;
    case '1min':
      return 1000 * 60;
    case '1h':
      return 1000 * 3600;
    case '1d':
      return 1000 * 3600 * 24;
    case 'none':
    default:
      return undefined;
  }
};

export const getTimestamp = (dataValue: DataValue, settings: SouthOPCUAItemSettings, oibusTimestamp: Instant): Instant => {
  switch (settings.timestampOrigin) {
    case 'point':
      return dataValue.sourceTimestamp ? dataValue.sourceTimestamp.toISOString() : oibusTimestamp;
    case 'server':
      return dataValue.serverTimestamp ? dataValue.serverTimestamp.toISOString() : oibusTimestamp;
    default:
      return oibusTimestamp;
  }
};

export const parseOPCUAValue = (itemName: string, opcuaVariant: Variant, logger: ILogger): string => {
  switch (opcuaVariant.dataType) {
    case DataType.String:
      return opcuaVariant.value ? opcuaVariant.value.split('\0')[0] : '';
    case DataType.Float:
    case DataType.Double:
    case DataType.SByte:
    case DataType.Int16:
    case DataType.Int32:
    case DataType.Byte:
    case DataType.UInt16:
    case DataType.UInt32:
      return opcuaVariant.value.toString();

    case DataType.UInt64:
      return Buffer.concat([
        new Uint8Array(Uint32Array.of(opcuaVariant.value[0]).buffer).reverse(),
        new Uint8Array(Uint32Array.of(opcuaVariant.value[1]).buffer).reverse()
      ])
        .readBigUInt64BE()
        .toString();
    case DataType.Int64:
      return Buffer.concat([
        new Uint8Array(Uint32Array.of(opcuaVariant.value[0]).buffer).reverse(),
        new Uint8Array(Uint32Array.of(opcuaVariant.value[1]).buffer).reverse()
      ])
        .readBigInt64BE()
        .toString();

    case DataType.ByteString:
      return opcuaVariant.value.toString('hex');

    case DataType.Boolean:
      return opcuaVariant.value ? '1' : '0';

    case DataType.DateTime:
      return DateTime.fromJSDate(opcuaVariant.value).toUTC().toISO()!;

    case DataType.Null:
      return '';

    case DataType.Variant:
    case DataType.DataValue:
    case DataType.DiagnosticInfo:
    case DataType.ExpandedNodeId:
    case DataType.ExtensionObject:
    case DataType.XmlElement:
    case DataType.NodeId:
    case DataType.LocalizedText:
    case DataType.QualifiedName:
    case DataType.Guid:
    case DataType.StatusCode:
      logger.debug(`Item ${itemName} with value ${opcuaVariant.value} of type ${opcuaVariant.dataType} could not be parsed`);
      return '';
  }
};

export const logMessages = (
  logs: Map<string, { description: string; affectedNodes: Array<string> }>,
  logger: ILogger,
  logCtx: Record<string, string> = {}
) => {
  for (const [statusCode, log] of logs.entries()) {
    if (log.affectedNodes.length > MAX_NUMBER_OF_NODE_TO_LOG) {
      logger.debug(
        logCtx,
        `${statusCode} status code (${log.description}): [${log.affectedNodes[0]}..${log.affectedNodes[log.affectedNodes.length - 1]}]`
      );
    } else {
      logger.debug(logCtx, `${log.description} with status code ${statusCode}: [${log.affectedNodes.toString()}]`);
    }
  }
};
