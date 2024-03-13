/**
 * Create a mock object for Registration Service
 */
export default jest.fn().mockImplementation(() => ({
  onUnregister: jest.fn(),
  updateRegistrationSettings: jest.fn()
}));
