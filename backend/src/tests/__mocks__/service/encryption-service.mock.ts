/**
 * Create a mock object for Encryption Service
 */
export default jest.fn().mockImplementation((keyFolder: string, certsFolder: string) => {
  return {
    keyFolder,
    certsFolder,
    generateSelfSignedCertificate: jest.fn(),
    decryptText: jest.fn(pass => pass),
    encryptText: jest.fn(pass => pass),
    filterSecrets: jest.fn(secrets => secrets),
    encryptConnectorSecrets: jest.fn(secrets => secrets)
  };
});
