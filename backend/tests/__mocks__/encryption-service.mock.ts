/**
 * Create a mock object for Encryption Service
 */
export default jest.fn().mockImplementation((keyFolder: string, certsFolder: string) => {
  return {
    keyFolder,
    certsFolder,
    decryptText: jest.fn(pass => pass)
  };
});
