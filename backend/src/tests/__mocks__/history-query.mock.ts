import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
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

  start = mock.fn(async () => undefined);
  stop = mock.fn();
  resetCache = mock.fn();
  finish = mock.fn();
  setLogger = mock.fn();
  metricsEvent = new EventEmitter();
  finishEvent = new EventEmitter();
  searchCacheContent = mock.fn();
  getFileFromCache = mock.fn();
  updateCacheContent = mock.fn();

  set historyQueryConfiguration(connectorConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    this.connector = connectorConfiguration;
  }

  get historyQueryConfiguration() {
    return this.connector;
  }
}
