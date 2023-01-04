/**
 * Create a mock object for SQLite database
 */
export default jest.fn().mockImplementation(() => {
  const execution = {
    run: jest.fn(() => ({ lastInsertRowId: 1 })),
    get: jest.fn(() => ({ id: "id1", settings: JSON.stringify({}) })),
    all: jest.fn(),
  };
  return {
    ...execution,
    prepare: jest.fn(() => execution),
  };
});
