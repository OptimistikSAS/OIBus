import { mock } from 'node:test';

/**
 * Create a mock object for North Connector repository
 */
export default class NorthConnectorRepositoryMock {
  findAllNorth = mock.fn();
  findAllNorthFull = mock.fn();
  findNorthById = mock.fn();
  saveNorth = mock.fn();
  startNorth = mock.fn();
  stopNorth = mock.fn();
  deleteNorth = mock.fn();
  addOrEditTransformer = mock.fn();
  removeTransformer = mock.fn();
  removeTransformersByTransformerId = mock.fn();
}
