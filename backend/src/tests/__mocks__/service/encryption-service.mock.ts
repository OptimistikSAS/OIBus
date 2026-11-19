import { mock } from 'node:test';

/**
 * Create a mock object for Encryption Service
 */
export default class EncryptionServiceMock {
  storedSettings = {};

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
  getTokenSecret = mock.fn((): Buffer => Buffer.from('token-secret'));
}
