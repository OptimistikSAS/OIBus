import { mock } from 'node:test';
import { SouthConnectorMetrics } from '../../../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import SouthConnectorMetricsService from '../../../../service/metrics/south-connector-metrics.service';
import SouthConnectorMock from '../../south-connector.mock';
import type SouthConnectorMetricsRepository from '../../../../repository/metrics/south-connector-metrics.repository';
import type { SouthConnectorEntity } from '../../../../model/south-connector.model';
import type { SouthSettings, SouthItemSettings } from '../../../../../shared/model/south-settings.model';

/**
 * Create a mock object for South Connector Metrics Service
 */
export default class SouthConnectorMetricsServiceMock extends SouthConnectorMetricsService {
  // Prototype method — intercepted during super() to suppress repo calls
  override initMetrics(): void {
    return;
  }

  constructor() {
    super(new SouthConnectorMock({} as SouthConnectorEntity<SouthSettings, SouthItemSettings>), null! as SouthConnectorMetricsRepository);
  }

  override updateMetrics = mock.fn((): void => undefined);
  override resetMetrics = mock.fn((): void => undefined);
  override destroy = mock.fn((): void => undefined);
  override get metrics(): SouthConnectorMetrics {
    return {} as SouthConnectorMetrics;
  }
  override get stream(): PassThrough {
    return new PassThrough();
  }
}
