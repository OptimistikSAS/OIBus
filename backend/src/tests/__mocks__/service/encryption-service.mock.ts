/**
 * Create a mock object for Encryption Service
 */
export default jest.fn().mockImplementation((keyFolder: string, certsFolder: string) => {
  return {
    keyFolder,
    certsFolder,
    cryptoSettings: {},
    generateSelfSignedCertificate: jest.fn(),
    encryptConnectorSecrets: jest.fn(secrets => secrets),
    decryptConnectorSecrets: jest.fn(secrets => secrets),
    filterSecrets: jest.fn(secrets => secrets),
    encryptText: jest.fn(pass => pass),
    decryptText: jest.fn(pass => pass),
    decryptTextWithPrivateKey: jest.fn(pass => pass),
    decryptSecretsWithPrivateKey: jest.fn(secrets => secrets)
  };
});
