/**
 * Create a mock object for Pino logger
 */
const mockFn = jest.fn().mockImplementation(() => {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockImplementation(mockFn)
  };
});

export default mockFn;
