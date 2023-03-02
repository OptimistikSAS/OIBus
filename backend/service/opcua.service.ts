import path from 'node:path';
import fs from 'node:fs/promises';
import { createFolder } from './utils';
import { CERT_FILE_NAME, CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME } from './encryption.service';

export const MAX_NUMBER_OF_NODE_TO_LOG = 10;

export const initOpcuaCertificateFolders = async (certFolder: string): Promise<void> => {
  const opcuaBaseFolder = path.resolve(certFolder, 'opcua');
  await createFolder(path.join(opcuaBaseFolder, 'own'));
  await createFolder(path.join(opcuaBaseFolder, 'own/certs'));
  await createFolder(path.join(opcuaBaseFolder, 'own/private'));
  await createFolder(path.join(opcuaBaseFolder, 'rejected'));
  await createFolder(path.join(opcuaBaseFolder, 'trusted'));
  await createFolder(path.join(opcuaBaseFolder, 'trusted/certs'));
  await createFolder(path.join(opcuaBaseFolder, 'trusted/crl'));

  await createFolder(path.join(opcuaBaseFolder, 'issuers'));
  await createFolder(path.join(opcuaBaseFolder, 'issuers/certs')); // contains Trusted CA certificates
  await createFolder(path.join(opcuaBaseFolder, 'issuers/crl')); // contains CRL of revoked CA certificates

  await fs.copyFile(path.resolve(`./`, CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME), `${opcuaBaseFolder}/own/private/private_key.pem`);
  await fs.copyFile(path.resolve(`./`, CERT_FOLDER, CERT_FILE_NAME), `${opcuaBaseFolder}/own/certs/client_certificate.pem`);
};
