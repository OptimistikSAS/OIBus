import { mock } from 'node:test';

// Mock the constructors
export const HistoryReadRequest = mock.fn((options: unknown) => ({
  ...(options as object),
  toString: () => 'HistoryReadRequest'
}));

export const ReadRawModifiedDetails = mock.fn((options: unknown) => ({
  ...(options as object),
  toString: () => 'ReadRawModifiedDetails'
}));

export const ReadProcessedDetails = mock.fn((options: unknown) => ({
  ...(options as object),
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
  OPCUAClient: { createSession: mock.fn(async () => ({})) },
  ClientSubscription: { create: mock.fn() },
  ClientMonitoredItem: { create: mock.fn() },
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
  OPCUACertificateManager: mock.fn(() => ({})),
  resolveNodeId: mock.fn((nodeId: unknown) => nodeId)
};
