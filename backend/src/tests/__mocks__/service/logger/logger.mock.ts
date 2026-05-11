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
    // Real pino loggers expose isLevelEnabled; the production code calls
    // it to gate hot-path template-literal interpolation. Default to true so
    // tests that assert a trace/debug call was made still see it happen.
    isLevelEnabled: jest.fn().mockReturnValue(true),
    child: jest.fn().mockImplementation(mockFn)
  };
});

export default mockFn;
