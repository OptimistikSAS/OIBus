/**
 * Create a mock object for Joi.ObjectSchema
 */
export default jest.fn().mockImplementation(() => {
  return {
    validateAsync: jest.fn(),
  };
});
