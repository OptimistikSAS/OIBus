import { mock } from 'node:test';
import { mockBaseFolders } from '../utils/test-utils';

/**
 * Create a mock object for Data Stream engine
 */
export default class DataStreamEngineMock {
  cacheFolders = mockBaseFolders('');
  logger: unknown;

  constructor(logger: unknown) {
    this.logger = logger;
  }

  start = mock.fn();
  stop = mock.fn();
  createNorth = mock.fn();
  startNorth = mock.fn();
  getNorth = mock.fn();
  getNorthSSE = mock.fn();
  getNorthMetrics = mock.fn();
  getAllNorthMetrics = mock.fn();
  resetNorthMetrics = mock.fn();
  reloadNorth = mock.fn();
  stopNorth = mock.fn();
  deleteNorth = mock.fn();
  createSouth = mock.fn();
  startSouth = mock.fn();
  getSouthSSE = mock.fn();
  getSouthMetrics = mock.fn();
  getAllSouthMetrics = mock.fn();
  resetSouthMetrics = mock.fn();
  reloadSouth = mock.fn();
  reloadSouthItems = mock.fn();
  stopSouth = mock.fn();
  deleteSouth = mock.fn();
  createHistoryQuery = mock.fn();
  startHistoryQuery = mock.fn();
  getHistoryQuerySSE = mock.fn();
  getHistoryMetrics = mock.fn();
  getAllHistoryMetrics = mock.fn();
  reloadHistoryQuery = mock.fn();
  stopHistoryQuery = mock.fn();
  resetHistoryQueryCache = mock.fn();
  deleteHistoryQuery = mock.fn();
  setLogger = mock.fn();
  addContent = mock.fn();
  addExternalContent = mock.fn();
  searchCacheContent = mock.fn();
  getFileFromCache = mock.fn();
  updateCacheContent = mock.fn();
  updateScanMode = mock.fn();
  updateNorthTransformerBySouth = mock.fn();
  updateNorthConfiguration = mock.fn();
  reloadTransformer = mock.fn();
  removeAndReloadTransformer = mock.fn();
}
