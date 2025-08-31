import { EventEmitter } from 'node:events';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { HistoryQueryEntity } from '../../model/histor-query.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

/**
 * Create a mock object for History Query
 */
export default class HistoryQueryMock {
  private connector: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;
  constructor(connector: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    this.connector = connector;
  }

  start = jest.fn().mockImplementation(() => Promise.resolve());
  stop = jest.fn();
  resetCache = jest.fn();
  finish = jest.fn();
  setLogger = jest.fn();
  metricsEvent = new EventEmitter();
  finishEvent = new EventEmitter();
  searchCacheContent = jest.fn();
  getCacheContentFileStream = jest.fn();
  removeCacheContent = jest.fn();
  removeAllCacheContent = jest.fn();
  moveCacheContent = jest.fn();
  moveAllCacheContent = jest.fn();

  set historyQueryConfiguration(connectorConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    this.connector = connectorConfiguration;
  }

  get historyQueryConfiguration() {
    return this.connector;
  }
}
