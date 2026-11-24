import crypto from 'node:crypto';
import os from 'node:os';

import { DateTime } from 'luxon';
import {
  AggregateFunction,
  ClientSession,
  DataType,
  DataValue,
  HistoryReadRequest,
  ICertificateStore,
  InMemoryCertificateKeyPairProvider,
  InMemoryCertificateStore,
  MessageSecurityMode,
  OPCUAClient,
  OPCUAClientOptions,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  StatusCode,
  StatusCodes,
  TimestampsToReturn,
  UserIdentityInfo,
  UserTokenType,
  Variant
} from 'node-opcua';
import { Certificate, convertPEMtoDER, exploreCertificate, split_der } from 'node-opcua-crypto';
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
import { ServerIdentity } from '../../shared/model/domain/server-identity.model';

import type { CertificateKeyPair } from '../model/certificate.model';
import type { ILogger } from '../model/logger.model';
import type CertificateService from './certificate.service';
import { encryptionService } from './encryption.service';
import { toX509ServerIdentity } from './utils-server-identity';

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

/** applicationUri of the certificate generated when the connector uses none (node-opcua's default one) */
const EPHEMERAL_APPLICATION_URI = `urn:${os.hostname()}:OIBus`;
let ephemeralProvider: Promise<InMemoryCertificateKeyPairProvider> | null = null;

/**
 * A certificate generated in memory once, for the connectors without certificate (security mode None, where the server
 * does not check it): node-opcua would otherwise create one in a PKI folder on disk.
 */
const getEphemeralProvider = (): Promise<InMemoryCertificateKeyPairProvider> => {
  ephemeralProvider ??= (async () => {
    const provider = new InMemoryCertificateKeyPairProvider();
    await provider.ensureCertificateExists({ applicationUri: EPHEMERAL_APPLICATION_URI, subject: '/CN=OIBus', dns: [os.hostname()] });
    return provider;
  })().catch((error: unknown) => {
    ephemeralProvider = null;
    throw error;
  });
  return ephemeralProvider;
};

/**
 * The certificate OIBus presents to the OPC UA server, given to node-opcua in memory: the private key of a certificate of
 * the store is never written to disk. With its applicationUri (the URN of its subjectAltName), which the client must
 * announce, or the server warns (W06) and may reject the session.
 */
export const getOPCUACertificate = async (
  keyPair: CertificateKeyPair | null
): Promise<{ provider: InMemoryCertificateKeyPairProvider; applicationUri: string | undefined }> => {
  if (!keyPair) {
    return { provider: await getEphemeralProvider(), applicationUri: EPHEMERAL_APPLICATION_URI };
  }
  const certificateDer = convertPEMtoDER(keyPair.certificate);
  const chain = keyPair.certificateChain ? split_der(convertPEMtoDER(keyPair.certificateChain)) : [];
  const privateKey = { hidden: crypto.createPrivateKey(keyPair.privateKey) };
  return {
    provider: new InMemoryCertificateKeyPairProvider([certificateDer, ...chain], privateKey),
    applicationUri: exploreCertificate(certificateDer).tbsCertificate.extensions?.subjectAltName?.uniformResourceIdentifier?.[0]
  };
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
 * The certificate of the server, without its chain: node-opcua gives the certificate of the endpoint, which may be a DER
 * chain, the certificate of the server first.
 */
const toServerCertificate = (certificate: Certificate | Array<Certificate>): Buffer =>
  Array.isArray(certificate) ? certificate[0] : split_der(certificate)[0];

/**
 * The trust store node-opcua checks the certificate of the server with (when securing the connection, so not with the
 * security mode None): it asks the connector whether it trusts the server (see `SouthConnector.verifyServerIdentity`),
 * instead of comparing thumbprints in memory. node-opcua checks it when it fetches the endpoint, before opening the secure
 * channel, so before sending any credential. In memory: no rejected/, trusted/, issuers/ folders on disk. The trust is
 * the connector's own, so a certificate is never trusted or rejected through the store itself.
 */
export class ServerIdentityCertificateStore implements ICertificateStore {
  referenceCounter = 0;

  constructor(private readonly isServerTrusted: (identity: ServerIdentity) => boolean) {}

  async initialize(): Promise<void> {
    // Nothing to load: the trust is the connector's own
  }

  async dispose(): Promise<void> {
    // Nothing to release
  }

  checkCertificate(certificate: Certificate | Array<Certificate>): Promise<StatusCode> {
    return Promise.resolve(
      this.isServerTrusted(toX509ServerIdentity(toServerCertificate(certificate))) ? StatusCodes.Good : StatusCodes.BadCertificateUntrusted
    );
  }

  async verifyCertificate(certificate: Certificate | Array<Certificate>): Promise<string> {
    return (await this.checkCertificate(certificate)).name;
  }

  async getTrustStatus(certificate: Certificate): Promise<StatusCode> {
    return await this.checkCertificate(certificate);
  }

  async trustCertificate(): Promise<void> {
    // Trusted by a user through the connector, never by node-opcua
  }

  async rejectCertificate(): Promise<void> {
    // Refused by the connector itself
  }

  async addIssuer(): Promise<void> {
    // The certificate of the server itself is trusted, not its issuer
  }

  async addRevocationList(): Promise<void> {
    // The certificate of the server itself is trusted, not its issuer
  }
}

/** The short name of an OPC UA security policy URI (`http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256`). */
const toSecurityPolicyName = (securityPolicyUri: string | null | undefined): string => {
  const uri = securityPolicyUri ?? '';
  return uri.substring(uri.lastIndexOf('#') + 1);
};

/**
 * The identity (the application certificate) the OPC UA server presents on the endpoint of the security mode and policy
 * of the settings, read from the endpoints the server advertises: no session is opened, so no credential is sent. `null`
 * with the security mode None, where the certificate of the server is not checked (nothing authenticates the server).
 */
export const retrieveOPCUAServerIdentity = async (settings: SouthOPCUASettings | NorthOPCUASettings): Promise<ServerIdentity | null> => {
  if (settings.securityMode === 'none') {
    return null;
  }
  const { provider, applicationUri } = await getOPCUACertificate(null);
  const client = OPCUAClient.create({
    applicationName: 'OIBus',
    applicationUri,
    connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
    transportTimeout: settings.connectionTimeout,
    endpointMustExist: false,
    certificateKeyPairProvider: provider,
    clientCertificateManager: new InMemoryCertificateStore()
  });
  try {
    const getEndpoints = async () => {
      await client.connect(settings.url);
      return await client.getEndpoints();
    };
    const endpoints = await withTimeout(
      getEndpoints,
      settings.connectionTimeout,
      `Connection timeout: no endpoint received after ${settings.connectionTimeout} ms`
    );
    const securityMode = toOPCUASecurityMode(settings.securityMode) as MessageSecurityMode;
    const securityPolicy = toOPCUASecurityPolicy(settings.securityPolicy)?.toLowerCase();
    const endpoint = endpoints.find(
      e =>
        e.securityMode === securityMode &&
        (!securityPolicy || toSecurityPolicyName(e.securityPolicyUri).toLowerCase() === securityPolicy) &&
        e.serverCertificate?.length
    );
    if (!endpoint) {
      throw new Error(
        `The server has no endpoint with the security mode "${settings.securityMode}" and the security policy "${settings.securityPolicy}"`
      );
    }
    return toX509ServerIdentity(toServerCertificate(endpoint.serverCertificate));
  } finally {
    await client.disconnect().catch(() => {
      /* the identity, or the error, is the result worth reporting */
    });
  }
};

/**
 * The options and user identity to open a session with. `isServerTrusted` decides whether the connection goes on with
 * the server presenting an identity (see `ServerIdentityCertificateStore`).
 */
export const createSessionConfigs = async (
  connectorId: string,
  connectorName: string,
  settings: SouthOPCUASettings | NorthOPCUASettings,
  requestTimeout: number,
  certificateService: CertificateService,
  isServerTrusted: (identity: ServerIdentity) => boolean
) => {
  const { provider, applicationUri } = await getOPCUACertificate(
    settings.certificateId ? certificateService.getKeyPair(settings.certificateId) : null
  );
  const options: OPCUAClientOptions = {
    applicationName: 'OIBus',
    applicationUri,
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
    // The certificate and its key in memory: node-opcua also gives this provider to the client it uses to find the
    // endpoint of the server
    certificateKeyPairProvider: provider,
    clientCertificateManager: new ServerIdentityCertificateStore(isServerTrusted)
  };

  let userIdentity: UserIdentityInfo;
  switch (settings.authentication.type) {
    case 'basic':
      userIdentity = {
        type: UserTokenType.UserName,
        userName: settings.authentication.username!,
        password: encryptionService.decryptText(settings.authentication.password!)
      };
      break;
    case 'cert': {
      // The certificate identifying the user, from the store: it is not the one securing the connection
      const { certificate, privateKey } = certificateService.getKeyPair(settings.authentication.certificateId!);
      userIdentity = {
        type: UserTokenType.Certificate,
        certificateData: convertPEMtoDER(certificate),
        privateKey
      };
      break;
    }
    default:
      userIdentity = { type: UserTokenType.Anonymous };
  }

  return { options, userIdentity };
};

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
