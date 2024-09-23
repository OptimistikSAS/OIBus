/**
 * Create a mock object for Subscription Service
 */
export default jest.fn().mockImplementation(() => ({
  findByNorth: jest.fn(),
  checkSubscription: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  deleteAllByNorth: jest.fn()
}));
