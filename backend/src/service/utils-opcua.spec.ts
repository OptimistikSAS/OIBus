import path from 'node:path';
import fs from 'node:fs/promises';
import nodeOPCUAMock from '../tests/__mocks__/node-opcua.mock';
import { DataType, DataValue, OPCUACertificateManager, TimestampsToReturn, UserTokenType, Variant } from 'node-opcua';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
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
import { encryptionService } from './encryption.service';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../shared/model/south-settings.model';
import { NorthOPCUASettings } from '../../shared/model/north-settings.model';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { DateTime } from 'luxon';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';

jest.mock('node:fs/promises');
jest.mock('node-opcua', () => ({
  ...nodeOPCUAMock,
  DataType: jest.requireActual('node-opcua').DataType,
  StatusCodes: jest.requireActual('node-opcua').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua').AttributeIds,
  UserTokenType: jest.requireActual('node-opcua').UserTokenType
}));
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

describe('Service utils OPCUA', () => {
  describe('initOPCUACertificateFolders', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (fs.stat as jest.Mock).mockImplementation(() => null);
    });

    it('should properly init OPCUA certificate folders', async () => {
      (encryptionService.getCertPath as jest.Mock).mockReturnValueOnce(path.resolve('cert_path'));
      (encryptionService.getPrivateKeyPath as jest.Mock).mockReturnValueOnce(path.resolve('private_key_path'));

      const folder = 'opcuaFolder';
      await initOPCUACertificateFolders(folder);
      expect(fs.stat).toHaveBeenCalledTimes(10);
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'own'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'own', 'certs'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'own', 'private'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'rejected'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'trusted'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'trusted', 'certs'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'trusted', 'crl'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'issuers'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'issuers', 'certs'));
      expect(fs.stat).toHaveBeenCalledWith(path.resolve(folder, 'opcua', 'issuers', 'crl'));
      expect(fs.copyFile).toHaveBeenCalledTimes(2);
      expect(fs.copyFile).toHaveBeenCalledWith(
        path.resolve('private_key_path'),
        path.resolve(folder, 'opcua', 'own', 'private', 'private_key.pem')
      );
      expect(fs.copyFile).toHaveBeenCalledWith(
        path.resolve('cert_path'),
        path.resolve(folder, 'opcua', 'own', 'certs', 'client_certificate.pem')
      );
    });
  });

  describe('toOPCUASecurityPolicy', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly convert into OPCUA SecurityPolicy', () => {
      expect(toOPCUASecurityPolicy('none')).toEqual('none');
      expect(toOPCUASecurityPolicy('basic128')).toEqual('Basic128');
      expect(toOPCUASecurityPolicy('basic192')).toEqual('Basic192');
      expect(toOPCUASecurityPolicy('basic192-rsa15')).toEqual('Basic192Rsa15');
      expect(toOPCUASecurityPolicy('basic256-rsa15')).toEqual('Basic256Rsa15');
      expect(toOPCUASecurityPolicy('basic256-sha256')).toEqual('Basic256Sha256');
      expect(toOPCUASecurityPolicy('basic256-sha256')).toEqual('Basic256Sha256');
      expect(toOPCUASecurityPolicy('aes128-sha256-rsa-oaep')).toEqual('Aes128_Sha256_RsaOaep');
      expect(toOPCUASecurityPolicy('aes128-sha256-rsa-oaep')).toEqual('Aes128_Sha256_RsaOaep');
      expect(toOPCUASecurityPolicy('pub-sub-aes-128-ctr')).toEqual('PubSub_Aes128_CTR');
      expect(toOPCUASecurityPolicy('pub-sub-aes-256-ctr')).toEqual('PubSub_Aes256_CTR');
      expect(toOPCUASecurityPolicy(null)).toBeUndefined();
    });
  });

  describe('toOPCUASecurityMode', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly convert into OPCUA SecurityMode', () => {
      expect(toOPCUASecurityMode('none')).toEqual(1);
      expect(toOPCUASecurityMode('sign')).toEqual(2);
      expect(toOPCUASecurityMode('sign-and-encrypt')).toEqual(3);
    });
  });

  describe('createSessionConfigs', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly create session configs without auth', async () => {
      const southSettings: SouthOPCUASettings = {
        throttling: {
          maxInstantPerItem: true,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0
        },
        sharedConnection: false,
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'none'
        },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false,
        retryInterval: 10_000,
        readTimeout: 15_000
      };
      expect(await createSessionConfigs('connectorId', 'connectorName', southSettings, {} as OPCUACertificateManager, 15_000)).toEqual({
        options: {
          applicationName: 'OIBus',
          clientCertificateManager: {},
          clientName: 'connectorName-connectorId',
          connectionStrategy: {
            initialDelay: 1000,
            maxRetry: 1
          },
          endpointMustExist: false,
          keepPendingSessionsOnDisconnect: false,
          keepSessionAlive: false,
          requestedSessionTimeout: 15000,
          securityMode: 1,
          securityPolicy: 'none'
        },
        userIdentity: { type: UserTokenType.Anonymous }
      });
    });

    it('should properly create session configs with basic auth', async () => {
      const southSettings: SouthOPCUASettings = {
        throttling: {
          maxInstantPerItem: true,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0
        },
        sharedConnection: false,
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'basic',
          username: 'user',
          password: 'password'
        },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false,
        retryInterval: 10_000,
        readTimeout: 15_000
      };
      expect(await createSessionConfigs('connectorId', 'connectorName', southSettings, {} as OPCUACertificateManager, 15_000)).toEqual({
        options: {
          applicationName: 'OIBus',
          clientCertificateManager: {},
          clientName: 'connectorName-connectorId',
          connectionStrategy: {
            initialDelay: 1000,
            maxRetry: 1
          },
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
      });
      expect(encryptionService.decryptText).toHaveBeenCalledWith(southSettings.authentication.password!);
    });

    it('should properly create session configs with cert auth', async () => {
      const northSettings: NorthOPCUASettings = {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'cert',
          certFilePath: 'cert_file.pem',
          keyFilePath: 'key_file.pem'
        },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false,
        retryInterval: 10_000
      };
      (fs.readFile as jest.Mock).mockReturnValueOnce('cert').mockReturnValueOnce('privateKey');
      expect(await createSessionConfigs('connectorId', 'connectorName', northSettings, {} as OPCUACertificateManager, undefined)).toEqual({
        options: {
          applicationName: 'OIBus',
          clientCertificateManager: {},
          clientName: 'connectorName-connectorId',
          connectionStrategy: {
            initialDelay: 1000,
            maxRetry: 1
          },
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
      });
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve(northSettings.authentication.certFilePath!));
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve(northSettings.authentication.keyFilePath!));
    });
  });

  describe('getHistoryReadRequest', () => {
    const startTime = '2025-09-01T00:00:00.000Z';
    const endTime = '2025-09-02T00:00:00.000Z';
    const nodesToRead: Array<HistoryReadValueIdOptions> = [
      { nodeId: 'ns=1;s=node1', indexRange: undefined, dataEncoding: undefined },
      { nodeId: 'ns=1;s=node2', indexRange: undefined, dataEncoding: undefined }
    ];

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "average" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'average', '10s', nodesToRead);
      expect(result.toString()).toEqual('HistoryReadRequest');
      expect(result.historyReadDetails!.toString()).toEqual('ReadProcessedDetails');
      expect(result.nodesToRead).toBe(nodesToRead);
      expect(result.timestampsToReturn).toBe(TimestampsToReturn.Both);
      expect(result.releaseContinuationPoints).toBe(false);
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "minimum" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'minimum', '10s', nodesToRead);
      expect(result.toString()).toEqual('HistoryReadRequest');
      expect(result.historyReadDetails!.toString()).toEqual('ReadProcessedDetails');
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "maximum" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'maximum', '10s', nodesToRead);
      expect(result.toString()).toEqual('HistoryReadRequest');
      expect(result.historyReadDetails!.toString()).toEqual('ReadProcessedDetails');
    });

    it('should return a HistoryReadRequest with ReadProcessedDetails for "count" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'count', '10s', nodesToRead);
      expect(result.toString()).toEqual('HistoryReadRequest');
      expect(result.historyReadDetails!.toString()).toEqual('ReadProcessedDetails');
    });

    it('should return a HistoryReadRequest with ReadRawModifiedDetails for "raw" aggregate', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'raw', undefined, nodesToRead);
      expect(result.toString()).toEqual('HistoryReadRequest');
      expect(result.historyReadDetails!.toString()).toEqual('ReadRawModifiedDetails');
    });

    it('should return a HistoryReadRequest with ReadRawModifiedDetails by default', () => {
      const result = getHistoryReadRequest(startTime, endTime, 'unknown', undefined, nodesToRead);
      expect(result.historyReadDetails!.toString()).toEqual('ReadRawModifiedDetails');
    });
  });

  describe('getResamplingValue', () => {
    it('should return 1000 for "second"', () => {
      const result = getResamplingValue('second');
      expect(result).toBe(1000);
    });

    it('should return 10000 for "10Seconds"', () => {
      const result = getResamplingValue('10Seconds');
      expect(result).toBe(10000);
    });

    it('should return 30000 for "30Seconds"', () => {
      const result = getResamplingValue('30Seconds');
      expect(result).toBe(30000);
    });

    it('should return 60000 for "minute"', () => {
      const result = getResamplingValue('minute');
      expect(result).toBe(60000);
    });

    it('should return 3600000 for "hour"', () => {
      const result = getResamplingValue('hour');
      expect(result).toBe(3600000);
    });

    it('should return 86400000 for "day"', () => {
      const result = getResamplingValue('day');
      expect(result).toBe(86400000);
    });

    it('should return undefined for "none"', () => {
      const result = getResamplingValue('none');
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      const result = getResamplingValue(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown input', () => {
      const result = getResamplingValue('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('getTimestamp', () => {
    const oibusTimestamp = '2025-09-04T12:00:00.000Z';

    it('should return sourceTimestamp when timestampOrigin is "point" and sourceTimestamp exists', () => {
      const dataValue = {
        sourceTimestamp: new Date('2025-09-04T10:00:00.000Z')
      } as DataValue;
      const settings: SouthOPCUAItemSettings = {
        timestampOrigin: 'point'
      } as SouthOPCUAItemSettings;
      const result = getTimestamp(dataValue, settings, oibusTimestamp);
      expect(result).toBe(dataValue.sourceTimestamp!.toISOString());
    });

    it('should return oibusTimestamp when timestampOrigin is "point" and sourceTimestamp is missing', () => {
      const dataValue = {} as DataValue;
      const settings: SouthOPCUAItemSettings = {
        timestampOrigin: 'point'
      } as SouthOPCUAItemSettings;
      const result = getTimestamp(dataValue, settings, oibusTimestamp);
      expect(result).toBe(oibusTimestamp);
    });

    it('should return serverTimestamp when timestampOrigin is "server" and serverTimestamp exists', () => {
      const dataValue = {
        serverTimestamp: new Date('2025-09-04T11:00:00.000Z')
      } as DataValue;
      const settings: SouthOPCUAItemSettings = {
        timestampOrigin: 'server'
      } as SouthOPCUAItemSettings;
      const result = getTimestamp(dataValue, settings, oibusTimestamp);
      expect(result).toBe(dataValue.serverTimestamp!.toISOString());
    });

    it('should return oibusTimestamp when timestampOrigin is "server" and serverTimestamp is missing', () => {
      const dataValue = {} as DataValue;
      const settings: SouthOPCUAItemSettings = {
        timestampOrigin: 'server'
      } as SouthOPCUAItemSettings;
      const result = getTimestamp(dataValue, settings, oibusTimestamp);
      expect(result).toBe(oibusTimestamp);
    });

    it('should return oibusTimestamp when timestampOrigin is not specified', () => {
      const dataValue = {
        sourceTimestamp: new Date('2025-09-04T10:00:00.000Z'),
        serverTimestamp: new Date('2025-09-04T11:00:00.000Z')
      } as DataValue;
      const settings = {} as SouthOPCUAItemSettings;
      const result = getTimestamp(dataValue, settings, oibusTimestamp);
      expect(result).toBe(oibusTimestamp);
    });

    it('should return oibusTimestamp when timestampOrigin is neither "point" nor "server"', () => {
      const dataValue = {
        sourceTimestamp: new Date('2025-09-04T10:00:00.000Z'),
        serverTimestamp: new Date('2025-09-04T11:00:00.000Z')
      } as DataValue;
      const settings: SouthOPCUAItemSettings = {
        timestampOrigin: 'other' as unknown
      } as SouthOPCUAItemSettings;
      const result = getTimestamp(dataValue, settings, oibusTimestamp);
      expect(result).toBe(oibusTimestamp);
    });
  });

  describe('parseOPCUAValue', () => {
    const logger: pino.Logger = new PinoLogger();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return the string value without null terminator for DataType.String', () => {
      const opcuaVariant = {
        dataType: DataType.String,
        value: 'test\0string'
      } as Variant;
      const result = parseOPCUAValue('item1', opcuaVariant, logger);
      expect(result).toBe('test');
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
        const result = parseOPCUAValue('item1', opcuaVariant, logger);
        expect(result).toBe(value.toString());
      });
    });

    it('should return the correct string representation for DataType.UInt64', () => {
      const opcuaVariant = {
        dataType: DataType.UInt64,
        value: [0x12345678, 0x9abcdef0]
      } as Variant;
      const result = parseOPCUAValue('item1', opcuaVariant, logger);
      expect(result).toBe('1311768467463790320');
    });

    it('should return the correct string representation for DataType.Int64', () => {
      const opcuaVariant = {
        dataType: DataType.Int64,
        value: [0x12345678, 0x9abcdef0]
      } as Variant;
      const result = parseOPCUAValue('item1', opcuaVariant, logger);
      expect(result).toBe('1311768467463790320');
    });

    it('should return the hex string for DataType.ByteString', () => {
      const opcuaVariant = {
        dataType: DataType.ByteString,
        value: Buffer.from([0x01, 0x02, 0x03])
      } as Variant;
      const result = parseOPCUAValue('item1', opcuaVariant, logger);
      expect(result).toBe('010203');
    });

    it('should return "1" for true and "0" for false for DataType.Boolean', () => {
      const trueVariant = { dataType: DataType.Boolean, value: true } as Variant;
      const falseVariant = { dataType: DataType.Boolean, value: false } as Variant;
      expect(parseOPCUAValue('item1', trueVariant, logger)).toBe('1');
      expect(parseOPCUAValue('item1', falseVariant, logger)).toBe('0');
    });

    it('should return the ISO string for DataType.DateTime', () => {
      const date = new Date('2025-09-04T12:00:00.000Z');
      const opcuaVariant = { dataType: DataType.DateTime, value: date } as Variant;
      const result = parseOPCUAValue('item1', opcuaVariant, logger);
      expect(result).toBe(DateTime.fromJSDate(date).toUTC().toISO());
    });

    it('should return an empty string for DataType.Null', () => {
      const opcuaVariant = { dataType: DataType.Null, value: null } as Variant;
      const result = parseOPCUAValue('item1', opcuaVariant, logger);
      expect(result).toBe('');
    });

    it('should log a debug message and return an empty string for unsupported DataTypes', () => {
      const logger = { debug: jest.fn() } as unknown as pino.Logger;
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
        const result = parseOPCUAValue('item1', opcuaVariant, logger);
        expect(result).toBe('');
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Item item1 with value [object Object] of type ${dataType} could not be parsed`)
        );
      });
    });
  });

  describe('logMessages', () => {
    const logger: pino.Logger = new PinoLogger();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should log all affected nodes if their number is less than or equal to MAX_NUMBER_OF_NODE_TO_LOG', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      logs.set('200', { description: 'Success', affectedNodes: ['node1', 'node2'] });

      logMessages(logs, logger);

      expect(logger.debug).toHaveBeenCalledWith('Success with status code 200: [node1,node2]');
    });

    it('should log first and last affected nodes if their number exceeds MAX_NUMBER_OF_NODE_TO_LOG', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      const nodes = Array.from({ length: MAX_NUMBER_OF_NODE_TO_LOG + 1 }, (_, i) => `node${i + 1}`);
      logs.set('500', { description: 'Error', affectedNodes: nodes });

      logMessages(logs, logger);

      expect(logger.debug).toHaveBeenCalledWith(`500 status code (Error): [node1..node${MAX_NUMBER_OF_NODE_TO_LOG + 1}]`);
    });

    it('should log nothing if logs map is empty', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();

      logMessages(logs, logger);

      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should handle multiple status codes in the logs map', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();
      logs.set('200', { description: 'Success', affectedNodes: ['node1', 'node2'] });
      logs.set('500', {
        description: 'Error',
        affectedNodes: Array.from({ length: MAX_NUMBER_OF_NODE_TO_LOG + 1 }, (_, i) => `node${i + 1}`)
      });

      logMessages(logs, logger);

      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith('Success with status code 200: [node1,node2]');
      expect(logger.debug).toHaveBeenCalledWith(`500 status code (Error): [node1..node${MAX_NUMBER_OF_NODE_TO_LOG + 1}]`);
    });

    it('should log nothing if logs map is empty', () => {
      const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();

      logMessages(logs, logger);

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});
