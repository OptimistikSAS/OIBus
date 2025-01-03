/**
 * Create a mock object for Transformer repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    searchTransformers: jest.fn(),
    findTransformerById: jest.fn(),
    saveTransformer: jest.fn(),
    deleteTransformer: jest.fn()
  };
});
