import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { beforeEach, describe, test } from 'vitest';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NotificationService } from '../../shared/notification.service';
import { NorthMetricsComponent } from './north-metrics.component';

describe('NorthMetricsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: NorthConnectorService, useValue: createMock(NorthConnectorService) },
        { provide: NotificationService, useValue: createMock(NotificationService) }
      ]
    });
  });

  test('should render with required inputs', () => {
    const fixture = TestBed.createComponent(NorthMetricsComponent);
    fixture.componentRef.setInput('northConnector', testData.north.listLight[0]);
    fixture.componentRef.setInput('connectorMetrics', testData.north.metrics);
    fixture.componentRef.setInput('manifest', testData.north.manifest);
    fixture.detectChanges();
  });
});
