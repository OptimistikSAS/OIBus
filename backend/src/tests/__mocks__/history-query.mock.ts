/**
 * Create a mock object for History Query
 */
export default jest.fn().mockImplementation(settings => {
  return {
    start: jest.fn().mockImplementation(() => Promise.resolve()),
    addContent: jest.fn(),
    stop: jest.fn(),
    resetCache: jest.fn(),
    finish: jest.fn(),
    setLogger: jest.fn(),
    getMetricsDataStream: jest.fn().mockReturnValue(settings.id),
    settings: settings
  };
});
