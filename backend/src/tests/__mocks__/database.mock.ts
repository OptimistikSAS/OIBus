export const run = jest.fn();
export const get = jest.fn();
export const all = jest.fn();

/**
 * Create a mock object for SQLite database
 */
export default jest.fn().mockImplementation(() => {
  return {
    prepare: jest.fn()
  };
});
