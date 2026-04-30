import { mock } from 'node:test';

/**
 * Create a mock object for Encryption Service
 */
export default class EncryptionServiceMock {
  keyFolder: string;
  certsFolder: string;
  cryptoSettings = {};

  constructor(keyFolder = '', certsFolder = '') {
    this.keyFolder = keyFolder;
    this.certsFolder = certsFolder;
  }

  generateSelfSignedCertificate = mock.fn();
  encryptConnectorSecrets = mock.fn((secrets: unknown) => secrets);
  decryptConnectorSecrets = mock.fn((secrets: unknown) => secrets);
  filterSecrets = mock.fn((secrets: unknown) => secrets);
  encryptText = mock.fn((pass: unknown) => pass);
  decryptText = mock.fn((pass: unknown) => pass);
  decryptTextWithPrivateKey = mock.fn((pass: unknown) => pass);
  decryptSecretsWithPrivateKey = mock.fn((secrets: unknown) => secrets);
  getCert = mock.fn(() => 'cert.pem');
  getCertPath = mock.fn(() => 'cert.pem');
  getPrivateKey = mock.fn(() => 'privateKey.pem');
  getPrivateKeyPath = mock.fn(() => 'privateKey.pem');
  getPublicKey = mock.fn(() => 'publicKey.pem');
  getPublicKeyPath = mock.fn(() => 'publicKey.pem');
}
