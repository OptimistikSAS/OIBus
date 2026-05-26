import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, test } from 'vitest';
import { provideRouter } from '@angular/router';

import { SouthMetricsComponent } from './south-metrics.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { NotificationService } from '../../../shared/notification.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from '../../../../test/vitest-create-mock';
import { SouthConnectorLightDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorMetrics } from '../../../../../../backend/shared/model/engine.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const southConnector = testData.south.list[0] as unknown as SouthConnectorLightDTO;
const metrics = testData.south.metrics as unknown as SouthConnectorMetrics;
const manifest = testData.south.manifest;

describe('SouthMetricsComponent', () => {
  beforeEach(() => {
    const southConnectorService = createMock(SouthConnectorService);
    const notificationService = createMock(NotificationService);

    southConnectorService.getSouthManifest.mockReturnValue(of(manifest));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should render with all inputs', () => {
    const fixture = TestBed.createComponent(SouthMetricsComponent);
    fixture.componentRef.setInput('southConnector', southConnector);
    fixture.componentRef.setInput('connectorMetrics', metrics);
    fixture.componentRef.setInput('manifest', manifest);
    fixture.detectChanges();
  });
});
