export default {
  OPCUAClient: { createSession: jest.fn(() => Promise.resolve({})) },
  ClientSubscription: { create: jest.fn() },
  ClientMonitoredItem: { create: jest.fn() },
  DataType: {},
  StatusCodes: {},
  SecurityPolicy: {},
  AttributeIds: {},
  UserTokenType: {},
  TimestampsToReturn: {},
  AggregateFunction: {},
  HistoryReadRequest: jest.fn(() => ({})),
  ReadRawModifiedDetails: jest.fn(() => ({})),
  ReadProcessedDetails: jest.fn(() => ({})),
  OPCUACertificateManager: jest.fn().mockImplementation(() => ({})),
  resolveNodeId: jest.fn(nodeId => nodeId)
};
