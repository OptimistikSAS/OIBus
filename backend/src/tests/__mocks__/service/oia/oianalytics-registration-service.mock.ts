import { EventEmitter } from 'node:events';

/**
 * Create a mock object for OIAnalytics Registration Service
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    getRegistrationSettings: jest.fn(),
    register: jest.fn(),
    checkRegistration: jest.fn(),
    editConnectionSettings: jest.fn(),
    updateKeys: jest.fn(),
    unregister: jest.fn(),
    stop: jest.fn(),
    registrationEvent: new EventEmitter()
  };
});
