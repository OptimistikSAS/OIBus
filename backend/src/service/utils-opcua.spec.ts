import path from 'node:path';
import fs from 'node:fs/promises';
import nodeOpcuaMock from '../tests/__mocks__/node-opcua.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { createSessionConfigs, initOPCUACertificateFolders, toOPCUASecurityMode, toOPCUASecurityPolicy } from './utils-opcua';
import { encryptionService } from './encryption.service';
import { OPCUACertificateManager, UserTokenType } from 'node-opcua';
import { SouthOPCUASettings } from '../../shared/model/south-settings.model';
import { NorthOPCUASettings } from '../../shared/model/north-settings.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('node-opcua', () => nodeOpcuaMock);
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
        sharedConnection: null,
        connectionSettings: {
          url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
          authentication: {
            type: 'none'
          },
          securityMode: 'none',
          securityPolicy: 'none',
          keepSessionAlive: false
        },
        retryInterval: 10_000,
        readTimeout: 15_000,
        flushMessageTimeout: 1000,
        maxNumberOfMessages: 1000
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
        sharedConnection: null,
        connectionSettings: {
          url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
          authentication: {
            type: 'basic',
            username: 'user',
            password: 'password'
          },
          securityMode: 'none',
          securityPolicy: 'none',
          keepSessionAlive: false
        },
        retryInterval: 10_000,
        readTimeout: 15_000,
        flushMessageTimeout: 1000,
        maxNumberOfMessages: 1000
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
          userName: southSettings.connectionSettings!.authentication.username!,
          password: southSettings.connectionSettings!.authentication.password!
        }
      });
      expect(encryptionService.decryptText).toHaveBeenCalledWith(southSettings.connectionSettings!.authentication.password!);
    });

    it('should properly create session configs with cert auth', async () => {
      const northSettings: NorthOPCUASettings = {
        sharedConnection: null,
        connectionSettings: {
          url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
          authentication: {
            type: 'cert',
            certFilePath: 'cert_file.pem',
            keyFilePath: 'key_file.pem'
          },
          securityMode: 'none',
          securityPolicy: 'none',
          keepSessionAlive: false
        },
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
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve(northSettings.connectionSettings!.authentication.certFilePath!));
      expect(fs.readFile).toHaveBeenCalledWith(path.resolve(northSettings.connectionSettings!.authentication.keyFilePath!));
    });
  });
});
