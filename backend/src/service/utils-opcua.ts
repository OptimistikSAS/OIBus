import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SouthOPCUASettings,
  SouthOPCUASettingsConnectionSettingsSecurityMode,
  SouthOPCUASettingsConnectionSettingsSecurityPolicy
} from '../../shared/model/south-settings.model';
import {
  NorthOPCUASettings,
  NorthOPCUASettingsConnectionSettingsSecurityMode,
  NorthOPCUASettingsConnectionSettingsSecurityPolicy
} from '../../shared/model/north-settings.model';
import { encryptionService } from './encryption.service';
import { OPCUACertificateManager, OPCUAClientOptions, UserIdentityInfo, UserTokenType } from 'node-opcua';
import { createFolder } from './utils';

export const toOPCUASecurityMode = (
  securityMode: SouthOPCUASettingsConnectionSettingsSecurityMode | NorthOPCUASettingsConnectionSettingsSecurityMode
): number => {
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
  securityPolicy: SouthOPCUASettingsConnectionSettingsSecurityPolicy | NorthOPCUASettingsConnectionSettingsSecurityPolicy | null | undefined
): string | undefined => {
  switch (securityPolicy) {
    case 'none':
      return 'none';
    case 'basic128':
      return 'Basic128';
    case 'basic192':
      return 'Basic192';
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

export const initOPCUACertificateFolders = async (folder: string): Promise<void> => {
  const opcuaBaseFolder = path.resolve(folder, 'opcua');
  await createFolder(path.join(opcuaBaseFolder, 'own'));
  await createFolder(path.join(opcuaBaseFolder, 'own', 'certs'));
  await createFolder(path.join(opcuaBaseFolder, 'own', 'private'));
  await createFolder(path.join(opcuaBaseFolder, 'rejected'));
  await createFolder(path.join(opcuaBaseFolder, 'trusted'));
  await createFolder(path.join(opcuaBaseFolder, 'trusted', 'certs'));
  await createFolder(path.join(opcuaBaseFolder, 'trusted', 'crl'));
  await createFolder(path.join(opcuaBaseFolder, 'issuers'));
  await createFolder(path.join(opcuaBaseFolder, 'issuers', 'certs')); // contains Trusted CA certificates
  await createFolder(path.join(opcuaBaseFolder, 'issuers', 'crl')); // contains CRL of revoked CA certificates

  await fs.copyFile(encryptionService.getPrivateKeyPath(), path.join(opcuaBaseFolder, 'own', 'private', 'private_key.pem'));
  await fs.copyFile(encryptionService.getCertPath(), path.join(opcuaBaseFolder, 'own', 'certs', 'client_certificate.pem'));
};

export const createSessionConfigs = async (
  connectorId: string,
  connectorName: string,
  settings: SouthOPCUASettings | NorthOPCUASettings,
  clientCertificateManager: OPCUACertificateManager,
  readTimeout: number | undefined
) => {
  const options: OPCUAClientOptions = {
    applicationName: 'OIBus',
    connectionStrategy: {
      initialDelay: 1000,
      maxRetry: 1
    },
    securityMode: toOPCUASecurityMode(settings.connectionSettings!.securityMode),
    securityPolicy: toOPCUASecurityPolicy(settings.connectionSettings!.securityPolicy),
    endpointMustExist: false,
    keepSessionAlive: settings.connectionSettings!.keepSessionAlive,
    requestedSessionTimeout: readTimeout,
    keepPendingSessionsOnDisconnect: false,
    clientName: `${connectorName}-${connectorId}`,
    clientCertificateManager
  };

  let userIdentity: UserIdentityInfo;
  switch (settings.connectionSettings!.authentication.type) {
    case 'basic':
      userIdentity = {
        type: UserTokenType.UserName,
        userName: settings.connectionSettings!.authentication.username!,
        password: await encryptionService.decryptText(settings.connectionSettings!.authentication.password!)
      };
      break;
    case 'cert':
      const certContent = await fs.readFile(path.resolve(settings.connectionSettings!.authentication.certFilePath!));
      const privateKeyContent = await fs.readFile(path.resolve(settings.connectionSettings!.authentication.keyFilePath!));
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
