import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, test } from 'vitest';
import { provideRouter } from '@angular/router';

import { NorthMetricsComponent } from './north-metrics.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorLightDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorMetrics } from '../../../../../backend/shared/model/engine.model';

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
    fixture.componentRef.setInput('northConnector', testData.north.list[0] as unknown as NorthConnectorLightDTO);
    fixture.componentRef.setInput('connectorMetrics', testData.north.metrics as unknown as NorthConnectorMetrics);
    fixture.componentRef.setInput('manifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.detectChanges();
  });
});
