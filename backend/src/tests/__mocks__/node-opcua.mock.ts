// Mock the constructors
export const HistoryReadRequest = jest.fn().mockImplementation(options => ({
  ...options,
  toString: () => 'HistoryReadRequest'
}));

export const ReadRawModifiedDetails = jest.fn().mockImplementation(options => ({
  ...options,
  toString: () => 'ReadRawModifiedDetails'
}));

export const ReadProcessedDetails = jest.fn().mockImplementation(options => ({
  ...options,
  toString: () => 'ReadProcessedDetails'
}));

export const AggregateFunction = {
  Average: 'Average',
  Minimum: 'Minimum',
  Maximum: 'Maximum',
  Count: 'Count'
};

export const TimestampsToReturn = {
  Both: 'Both'
};

export default {
  OPCUAClient: { createSession: jest.fn(() => Promise.resolve({})) },
  ClientSubscription: { create: jest.fn() },
  ClientMonitoredItem: { create: jest.fn() },
  DataType: {},
  StatusCodes: {},
  SecurityPolicy: {},
  AttributeIds: {},
  UserTokenType: {},
  TimestampsToReturn,
  AggregateFunction,
  HistoryReadRequest,
  ReadRawModifiedDetails,
  ReadProcessedDetails,
  OPCUACertificateManager: jest.fn().mockImplementation(() => ({})),
  resolveNodeId: jest.fn(nodeId => nodeId)
};
