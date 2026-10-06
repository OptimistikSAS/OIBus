import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, test } from 'vitest';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock } from '../../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { NotificationService } from '../../../shared/notification.service';
import { SouthMetricsComponent } from './south-metrics.component';

const southConnector = testData.south.listLight[0];
const metrics = testData.south.metrics;
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
