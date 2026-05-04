import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DataType, DataValue, OPCUACertificateManager, TimestampsToReturn, UserTokenType, Variant } from 'node-opcua';
import { encryptionService } from './encryption.service';
import {
  createSessionConfigs,
  getHistoryReadRequest,
  getResamplingValue,
  getTimestamp,
  initOPCUACertificateFolders,
  logMessages,
  MAX_NUMBER_OF_NODE_TO_LOG,
  parseOPCUAValue,
  toOPCUASecurityMode,
  toOPCUASecurityPolicy
} from './utils-opcua';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../shared/model/south-settings.model';
import { NorthOPCUASettings } from '../../shared/model/north-settings.model';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { DateTime } from 'luxon';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';

describe('Service utils OPCUA', () => {
  describe('initOPCUACertificateFolders', () => {
    let statMock: ReturnType<typeof mock.fn>;
    let copyFileMock: ReturnType<typeof mock.fn>;

    beforeEach(() => {
      statMock = mock.method(fs, 'stat', async () => null) as ReturnType<typeof mock.fn>;
      copyFileMock = mock.method(fs, 'copyFile', async () => undefined) as ReturnType<typeof mock.fn>;
      mock.method(encryptionService, 'getCertPath', () => path.resolve('cert_path'));
      mock.method(encryptionService, 'getPrivateKeyPath', () => path.resolve('private_key_path'));
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('should properly init OPCUA certificate folders', async () => {
      const folder = 'opcuaFolder';
      await initOPCUACertificateFolders(folder);
      assert.strictEqual(statMock.mock.calls.length, 10);
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'own')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'own', 'certs')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'own', 'private')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'rejected')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'trusted')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'trusted', 'certs')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'trusted', 'crl')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'issuers')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'issuers', 'certs')));
      assert.ok(statMock.mock.calls.some(c => c.arguments[0] === path.resolve(folder, 'opcua', 'issuers', 'crl')));
      assert.strictEqual(copyFileMock.mock.calls.length, 2);
      assert.ok(
        copyFileMock.mock.calls.some(
          c =>
            c.arguments[0] === path.resolve('private_key_path') &&
            c.arguments[1] === path.resolve(folder, 'opcua', 'own', 'private', 'private_key.pem')
        )
      );
      assert.ok(
        copyFileMock.mock.calls.some(
          c =>
            c.arguments[0] === path.resolve('cert_path') &&
            c.arguments[1] === path.resolve(folder, 'opcua', 'own', 'certs', 'client_certificate.pem')
        )
      );
    });
  });

  describe('toOPCUASecurityPolicy', () => {
    it('should properly convert into OPCUA SecurityPolicy', () => {
      assert.strictEqual(toOPCUASecurityPolicy('none'), 'none');
      assert.strictEqual(toOPCUASecurityPolicy('basic128'), 'Basic128');
      assert.strictEqual(toOPCUASecurityPolicy('basic192'), 'Basic192');
      assert.strictEqual(toOPCUASecurityPolicy('basic256'), 'Basic256');
      assert.strictEqual(toOPCUASecurityPolicy('basic128-rsa15'), 'Basic128Rsa15');
      assert.strictEqual(toOPCUASecurityPolicy('basic192-rsa15'), 'Basic192Rsa15');
      assert.strictEqual(toOPCUASecurityPolicy('basic256-rsa15'), 'Basic256Rsa15');
      assert.strictEqual(toOPCUASecurityPolicy('basic256-sha256'), 'Basic256Sha256');
      assert.strictEqual(toOPCUASecurityPolicy('aes128-sha256-rsa-oaep'), 'Aes128_Sha256_RsaOaep');
      assert.strictEqual(toOPCUASecurityPolicy('pub-sub-aes-128-ctr'), 'PubSub_Aes128_CTR');
      assert.strictEqual(toOPCUASecurityPolicy('pub-sub-aes-256-ctr'), 'PubSub_Aes256_CTR');
      assert.strictEqual(toOPCUASecurityPolicy(null), undefined);
    });
  });

  describe('toOPCUASecurityMode', () => {
    it('should properly convert into OPCUA SecurityMode', () => {
      assert.strictEqual(toOPCUASecurityMode('none'), 1);
      assert.strictEqual(toOPCUASecurityMode('sign'), 2);
      assert.strictEqual(toOPCUASecurityMode('sign-and-encrypt'), 3);
    });
  });

  describe('createSessionConfigs', () => {
    let decryptTextMock: ReturnType<typeof mock.fn>;
    let readFileMock: ReturnType<typeof mock.fn>;

    beforeEach(() => {
      decryptTextMock = mock.method(encryptionService, 'decryptText', async (text: unknown) => text) as ReturnType<typeof mock.fn>;
      readFileMock = mock.method(fs, 'readFile', async () => '') as ReturnType<typeof mock.fn>;
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('should properly create session configs without auth', async () => {
      const southSettings: SouthOPCUASettings = {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: { type: 'none' },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false,
        retryInterval: 10_000,
        readTimeout: 15_000,
        flushMessageTimeout: 1000,
        maxNumberOfMessages: 1000
      };
      assert.deepStrictEqual(
        await createSessionConfigs('connectorId', 'connectorName', southSettings, {} as OPCUACertificateManager, 15_000),
        {
          options: {
            applicationName: 'OIBus',
            clientCertificateManager: {},
            clientName: 'connectorName-connectorId',
            connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
            endpointMustExist: false,
            keepPendingSessionsOnDisconnect: false,
            keepSessionAlive: false,
            requestedSessionTimeout: 15000,
            securityMode: 1,
            securityPolicy: 'none'
          },
          userIdentity: { type: UserTokenType.Anonymous }
        }
      );
    });

    it('should properly create session configs with basic auth', async () => {
      const southSettings: SouthOPCUASettings = {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: { type: 'basic', username: 'user', password: 'password' },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false,
        retryInterval: 10_000,
        readTimeout: 15_000,
        flushMessageTimeout: 1000,
        maxNumberOfMessages: 1000
      };
      assert.deepStrictEqual(
        await createSessionConfigs('connectorId', 'connectorName', southSettings, {} as OPCUACertificateManager, 15_000),
        {
          options: {
            applicationName: 'OIBus',
            clientCertificateManager: {},
            clientName: 'connectorName-connectorId',
            connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
            endpointMustExist: false,
            keepPendingSessionsOnDisconnect: false,
            keepSessionAlive: false,
            requestedSessionTimeout: 15000,
            securityMode: 1,
            securityPolicy: 'none'
          },
          userIdentity: {
            type: UserTokenType.UserName,
            userName: southSettings.authentication.username!,
            password: southSettings.authentication.password!
          }
        }
      );
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, [southSettings.authentication.password!]);
    });

    it('should properly create session configs with cert auth', async () => {
      const northSettings: NorthOPCUASettings = {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: { type: 'cert', certFilePath: 'cert_file.pem', keyFilePath: 'key_file.pem' },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false,
        retryInterval: 10_000
      };
      readFileMock.mock.mockImplementation(async (filePath: unknown) => {
        if (String(filePath).endsWith('cert_file.pem')) return 'cert';
        if (String(filePath).endsWith('key_file.pem')) return 'privateKey';
        return '';
      });
      assert.deepStrictEqual(
        await createSessionConfigs('connectorId', 'connectorName', northSettings, {} as OPCUACertificateManager, undefined),
        {
          options: {
            applicationName: 'OIBus',
            clientCertificateManager: {},
            clientName: 'connectorName-connectorId',
            connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
            endpointMustExist: false,
            keepPendingSessionsOnDisconnect: false,
            keepSessionAlive: false,
            requestedSessionTimeout: undefined,
            securityMode: 1,
            securityPolicy: 'none'
          },
          userIdentity: {
            type: UserTokenType.Certificate,
            certificateData: 'cert',
            privateKey: 'privateKey'
          }
        }
      );
      assert.strictEqual(readFileMock.mock.calls.length, 2);
      assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[0], path.resolve(northSettings.authentication.certFilePath!));
      assert.deepStrictEqual(readFileMock.mock.calls[1].arguments[0], path.resolve(northSettings.authentication.keyFilePath!));
    });
  });

  describe('getHistoryReadRequest', () => {
    const startTime = '2025-09-01T00:00:00.000Z';
    const endTime = '2025-09-02T00:00:00.000Z';
    const nodesToRead: Array<HistoryReadValueIdOptions> = [
      { nodeId: 'ns=1;s=node1', indexRange: undefined, dataEncoding: undefined },
      { nodeId: 'ns=1;s=node2', indexRange: undefined, dataEncoding: undefined }
    ];

    it('should return a HistoryReadRequest with ReadProcessedDetails for "average" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'average', '10s', nodesToRead);
      assert.strictEqual(result.constructor.name, 'HistoryReadRequest');
      assert.strictEqual(result.historyReadDetails!.constructor.name, 'ReadProcessedDetails');
      assert.strictEqual(result.nodesToRead!.length, nodesToRead.length);
      assert.strictEqual(result.timestampsToReturn, TimestampsToReturn.Both);
      assert.strictEqual(result.releaseContinuationPoints, false);
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "minimum" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'minimum', '10s', nodesToRead);
      assert.strictEqual(result.constructor.name, 'HistoryReadRequest');
      assert.strictEqual(result.historyReadDetails!.constructor.name, 'ReadProcessedDetails');
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "maximum" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'maximum', '10s', nodesToRead);
      assert.strictEqual(result.constructor.name, 'HistoryReadRequest');
      assert.strictEqual(result.historyReadDetails!.constructor.name, 'ReadProcessedDetails');
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "count" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'count', '10s', nodesToRead);
      assert.strictEqual(result.constructor.name, 'HistoryReadRequest');
      assert.strictEqual(result.historyReadDetails!.constructor.name, 'ReadProcessedDetails');
    });

    it('should return a HistoryReadRequest with ReadRawModifiedDetails for "raw" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'raw', undefined, nodesToRead);
      assert.strictEqual(result.constructor.name, 'HistoryReadRequest');
      assert.strictEqual(result.historyReadDetails!.constructor.name, 'ReadRawModifiedDetails');
    });

    it('should return a HistoryReadRequest with ReadRawModifiedDetails by default', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'unknown', undefined, nodesToRead);
      assert.strictEqual(result.historyReadDetails!.constructor.name, 'ReadRawModifiedDetails');
    });
  });

  describe('getResamplingValue', () => {
    it('should return 1000 for "second"', () => {
      assert.strictEqual(getResamplingValue('second'), 1000);
    });
    it('should return 10000 for "10Seconds"', () => {
      assert.strictEqual(getResamplingValue('10Seconds'), 10000);
    });
    it('should return 30000 for "30Seconds"', () => {
      assert.strictEqual(getResamplingValue('30Seconds'), 30000);
    });
    it('should return 60000 for "minute"', () => {
      assert.strictEqual(getResamplingValue('minute'), 60000);
    });
    it('should return 3600000 for "hour"', () => {
      assert.strictEqual(getResamplingValue('hour'), 3600000);
    });
    it('should return 86400000 for "day"', () => {
      assert.strictEqual(getResamplingValue('day'), 86400000);
    });
    it('should return undefined for "none"', () => {
      assert.strictEqual(getResamplingValue('none'), undefined);
    });
    it('should return undefined for undefined input', () => {
      assert.strictEqual(getResamplingValue(undefined), undefined);
    });
    it('should return undefined for unknown input', () => {
      assert.strictEqual(getResamplingValue('unknown'), undefined);
    });
  });

  describe('getTimestamp', () => {
    const oibusTimestamp = '2025-09-04T12:00:00.000Z';

    it('should return sourceTimestamp when timestampOrigin is "point" and sourceTimestamp exists', () => {
      const dataValue = { sourceTimestamp: new Date('2025-09-04T10:00:00.000Z') } as DataValue;
      const settings: SouthOPCUAItemSettings = { timestampOrigin: 'point' } as SouthOPCUAItemSettings;
      assert.strictEqual(getTimestamp(dataValue, settings, oibusTimestamp), dataValue.sourceTimestamp!.toISOString());
    });

    it('should return oibusTimestamp when timestampOrigin is "point" and sourceTimestamp is missing', () => {
      const dataValue = {} as DataValue;
      const settings: SouthOPCUAItemSettings = { timestampOrigin: 'point' } as SouthOPCUAItemSettings;
      assert.strictEqual(getTimestamp(dataValue, settings, oibusTimestamp), oibusTimestamp);
    });

    it('should return serverTimestamp when timestampOrigin is "server" and serverTimestamp exists', () => {
      const dataValue = { serverTimestamp: new Date('2025-09-04T11:00:00.000Z') } as DataValue;
      const settings: SouthOPCUAItemSettings = { timestampOrigin: 'server' } as SouthOPCUAItemSettings;
      assert.strictEqual(getTimestamp(dataValue, settings, oibusTimestamp), dataValue.serverTimestamp!.toISOString());
    });

    it('should return oibusTimestamp when timestampOrigin is "server" and serverTimestamp is missing', () => {
      const dataValue = {} as DataValue;
      const settings: SouthOPCUAItemSettings = { timestampOrigin: 'server' } as SouthOPCUAItemSettings;
      assert.strictEqual(getTimestamp(dataValue, settings, oibusTimestamp), oibusTimestamp);
    });

    it('should return oibusTimestamp when timestampOrigin is not specified', () => {
      const dataValue = {
        sourceTimestamp: new Date('2025-09-04T10:00:00.000Z'),
        serverTimestamp: new Date('2025-09-04T11:00:00.000Z')
      } as DataValue;
      const settings = {} as SouthOPCUAItemSettings;
      assert.strictEqual(getTimestamp(dataValue, settings, oibusTimestamp), oibusTimestamp);
    });

    it('should return oibusTimestamp when timestampOrigin is neither "point" nor "server"', () => {
      const dataValue = {
        sourceTimestamp: new Date('2025-09-04T10:00:00.000Z'),
        serverTimestamp: new Date('2025-09-04T11:00:00.000Z')
      } as DataValue;
      const settings: SouthOPCUAItemSettings = { timestampOrigin: 'other' as unknown } as SouthOPCUAItemSettings;
      assert.strictEqual(getTimestamp(dataValue, settings, oibusTimestamp), oibusTimestamp);
    });
  });

  describe('parseOPCUAValue', () => {
    let logger: PinoLogger;

    beforeEach(() => {
      logger = new PinoLogger();
    });

    it('should return the string value without null terminator for DataType.String', () => {
      const opcuaVariant = { dataType: DataType.String, value: 'test\0string' } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), 'test');
    });

    it('should return empty string if DataType.String has a null value', () => {
      const opcuaVariant = { dataType: DataType.String, value: null } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), '');
    });

    it('should return the string representation for numeric DataTypes', () => {
      const testCases = [
        { dataType: DataType.Float, value: 3.14 },
        { dataType: DataType.Double, value: 3.14159 },
        { dataType: DataType.SByte, value: -128 },
        { dataType: DataType.Int16, value: -32768 },
        { dataType: DataType.Int32, value: -2147483648 },
        { dataType: DataType.Byte, value: 255 },
        { dataType: DataType.UInt16, value: 65535 },
        { dataType: DataType.UInt32, value: 4294967295 }
      ];
      testCases.forEach(({ dataType, value }) => {
        const opcuaVariant = { dataType, value } as Variant;
        assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), value.toString());
      });
    });

    it('should return the correct string representation for DataType.UInt64', () => {
      const opcuaVariant = { dataType: DataType.UInt64, value: [0x12345678, 0x9abcdef0] } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), '1311768467463790320');
    });

    it('should return the correct string representation for DataType.Int64', () => {
      const opcuaVariant = { dataType: DataType.Int64, value: [0x12345678, 0x9abcdef0] } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), '1311768467463790320');
    });

    it('should return the hex string for DataType.ByteString', () => {
      const opcuaVariant = { dataType: DataType.ByteString, value: Buffer.from([0x01, 0x02, 0x03]) } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), '010203');
    });

    it('should return "1" for true and "0" for false for DataType.Boolean', () => {
      const trueVariant = { dataType: DataType.Boolean, value: true } as Variant;
      const falseVariant = { dataType: DataType.Boolean, value: false } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', trueVariant, logger), '1');
      assert.strictEqual(parseOPCUAValue('item1', falseVariant, logger), '0');
    });

    it('should return the ISO string for DataType.DateTime', () => {
      const date = new Date('2025-09-04T12:00:00.000Z');
      const opcuaVariant = { dataType: DataType.DateTime, value: date } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), DateTime.fromJSDate(date).toUTC().toISO());
    });

    it('should return an empty string for DataType.Null', () => {
      const opcuaVariant = { dataType: DataType.Null, value: null } as Variant;
      assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, logger), '');
    });

    it('should log a debug message and return an empty string for unsupported DataTypes', () => {
      const debugLogger = new PinoLogger();
      const testCases = [
        DataType.Variant,
        DataType.DataValue,
        DataType.DiagnosticInfo,
        DataType.ExpandedNodeId,
        DataType.ExtensionObject,
        DataType.XmlElement,
        DataType.NodeId,
        DataType.LocalizedText,
        DataType.QualifiedName,
        DataType.Guid,
        DataType.StatusCode
      ];
      testCases.forEach(dataType => {
        const opcuaVariant = { dataType, value: {} } as Variant;
        assert.strictEqual(parseOPCUAValue('item1', opcuaVariant, debugLogger), '');
        assert.ok(
          (debugLogger.debug as ReturnType<typeof mock.fn>).mock.calls.some(
            c =>
              typeof c.arguments[0] === 'string' &&
              (c.arguments[0] as string).includes(`Item item1 with value [object Object] of type ${dataType} could not be parsed`)
          )
        );
      });
    });
  });

  describe('logMessages', () => {
    let logger: PinoLogger;

    beforeEach(() => {
      logger = new PinoLogger();
    });

    it('should log all affected nodes if their number is less than or equal to MAX_NUMBER_OF_NODE_TO_LOG', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      logs.set('200', { description: 'Success', affectedNodes: ['node1', 'node2'] });
      logMessages(logs, logger);
      assert.deepStrictEqual((logger.debug as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        'Success with status code 200: [node1,node2]'
      ]);
    });

    it('should log first and last affected nodes if their number exceeds MAX_NUMBER_OF_NODE_TO_LOG', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      const nodes = Array.from({ length: MAX_NUMBER_OF_NODE_TO_LOG + 1 }, (_, i) => `node${i + 1}`);
      logs.set('500', { description: 'Error', affectedNodes: nodes });
      logMessages(logs, logger);
      assert.deepStrictEqual((logger.debug as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        `500 status code (Error): [node1..node${MAX_NUMBER_OF_NODE_TO_LOG + 1}]`
      ]);
    });

    it('should log nothing if logs map is empty', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      logMessages(logs, logger);
      assert.strictEqual((logger.debug as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    });

    it('should handle multiple status codes in the logs map', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      logs.set('200', { description: 'Success', affectedNodes: ['node1', 'node2'] });
      logs.set('500', {
        description: 'Error',
        affectedNodes: Array.from({ length: MAX_NUMBER_OF_NODE_TO_LOG + 1 }, (_, i) => `node${i + 1}`)
      });
      logMessages(logs, logger);
      assert.strictEqual((logger.debug as ReturnType<typeof mock.fn>).mock.calls.length, 2);
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some(c => c.arguments[0] === 'Success with status code 200: [node1,node2]')
      );
      assert.ok(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some(
          c => c.arguments[0] === `500 status code (Error): [node1..node${MAX_NUMBER_OF_NODE_TO_LOG + 1}]`
        )
      );
    });
  });
});
