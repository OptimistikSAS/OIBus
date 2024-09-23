/**
 * Create a mock object for Crypto repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    getCryptoSettings: jest.fn(),
    createCryptoSettings: jest.fn()
  };
});
