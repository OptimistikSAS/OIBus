import { mock } from 'node:test';
import { NorthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import NorthConnectorMetricsService from '../../../../service/metrics/north-connector-metrics.service';
import NorthConnectorMock from '../../north-connector.mock';
import type NorthConnectorMetricsRepository from '../../../../repository/metrics/north-connector-metrics.repository';
import type { NorthConnectorEntity } from '../../../../model/north-connector.model';
import type { NorthSettings } from '../../../../../shared/model/north-settings.model';

/**
 * Create a mock object for North Connector Metrics Service
 */
export default class NorthConnectorMetricsServiceMock extends NorthConnectorMetricsService {
  // Prototype method — intercepted during super() to suppress repo calls
  override initMetrics(): void {
    return;
  }

  constructor() {
    super(
      new NorthConnectorMock({} as NorthConnectorEntity<NorthSettings>),
      null! as NorthConnectorMetricsRepository
    );
  }

  override updateMetrics = mock.fn((): void => undefined);
  override resetMetrics = mock.fn((): void => undefined);
  override destroy = mock.fn((): void => undefined);
  override get metrics(): NorthConnectorMetrics { return {} as NorthConnectorMetrics; }
  override get stream(): PassThrough { return new PassThrough(); }
}
