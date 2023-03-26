/**
 * Create a mock object for South Service
 */
export default jest.fn().mockImplementation(() => ({
  createSouth: jest.fn(),
  getSouth: jest.fn(),
  getSouthList: jest.fn(),
  getSouthItems: jest.fn()
}));
