/**
 * Create a mock object for SQLite database
 */
export default jest.fn().mockImplementation(() => {
  const execution = {
    run: jest.fn(() => ({ lastInsertRowId: 1 })),
    get: jest.fn(),
    all: jest.fn(),
  };
  return {
    ...execution,
    prepare: jest.fn(() => execution),
  };
});
