/**
 * Create a mock object for OIBus Transformer
 */
export default class OIBusTransformerMock {
  northConnector = {};
  transformer = {};
  logger = {};
  transform = jest.fn();
  // In-memory fast path on the real base class. Default to a resolved value so
  // tests that don't set a return value still get { metadata, output } shapes
  // wherever north-connector destructures the result.
  transformInMemory = jest.fn();
}
