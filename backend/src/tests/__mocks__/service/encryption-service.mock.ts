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

  generateSelfSignedCertificate = mock.fn(async (): Promise<{ private: string; public: string; cert: string }> => ({
    private: '',
    public: '',
    cert: ''
  }));
  encryptConnectorSecrets = mock.fn(<T>(secrets: T): T => secrets);
  decryptConnectorSecrets = mock.fn(<T>(secrets: T): T => secrets);
  filterSecrets = mock.fn(<T>(secrets: T, _formSettings: unknown): T => secrets);
  encryptText = mock.fn((pass: string | null | undefined): string => pass ?? '');
  decryptText = mock.fn((pass: string | null | undefined): string => pass ?? '');
  decryptTextWithPrivateKey = mock.fn((pass: string): string => pass);
  decryptSecretsWithPrivateKey = mock.fn(<T>(secrets: T): T => secrets);
  getCert = mock.fn(async (): Promise<string> => 'cert.pem');
  getCertPath = mock.fn((): string => 'cert.pem');
  getPrivateKey = mock.fn(async (): Promise<string> => 'privateKey.pem');
  getPrivateKeyPath = mock.fn((): string => 'privateKey.pem');
  getPublicKey = mock.fn(async (): Promise<string> => 'publicKey.pem');
  getPublicKeyPath = mock.fn((): string => 'publicKey.pem');
}
