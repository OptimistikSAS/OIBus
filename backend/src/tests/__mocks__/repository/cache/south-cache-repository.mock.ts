/**
 * Create a mock object for South Cache Repository
 */
export default jest.fn().mockImplementation(() => ({
  createItemValueTable: jest.fn(),
  dropItemValueTable: jest.fn(),
  getItemLastValue: jest.fn(),
  saveItemLastValue: jest.fn(),
  deleteItemValue: jest.fn()
}));
