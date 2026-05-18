import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, test } from 'vitest';

import { EditHistoryQueryComponent } from './edit-history-query.component';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';

function configure(activatedRouteValue: object): MockObject<HistoryQueryService> {
  const historyQueryService = createMock(HistoryQueryService);
  const northConnectorService = createMock(NorthConnectorService);
  const southConnectorService = createMock(SouthConnectorService);
  const scanModeService = createMock(ScanModeService);
  const certificateService = createMock(CertificateService);
  const transformerService = createMock(TransformerService);

  northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
  southConnectorService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
  northConnectorService.list.mockReturnValue(of([]));
  southConnectorService.list.mockReturnValue(of([]));
  scanModeService.list.mockReturnValue(of([]));
  certificateService.list.mockReturnValue(of([]));
  transformerService.list.mockReturnValue(of([]));
  historyQueryService.list.mockReturnValue(of([]));

  TestBed.configureTestingModule({
    providers: [
      provideI18nTesting(),
      provideRouter([]),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: activatedRouteValue },
      { provide: HistoryQueryService, useValue: historyQueryService },
      { provide: NorthConnectorService, useValue: northConnectorService },
      { provide: SouthConnectorService, useValue: southConnectorService },
      { provide: ScanModeService, useValue: scanModeService },
      { provide: CertificateService, useValue: certificateService },
      { provide: TransformerService, useValue: transformerService },
      { provide: NotificationService, useValue: createMock(NotificationService) },
      { provide: ModalService, useValue: createMock(ModalService) },
      { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) },
      { provide: ConfirmationService, useValue: createMock(ConfirmationService) }
    ]
  });

  return historyQueryService;
}

describe('EditHistoryQueryComponent', () => {
  test('should create in create mode', () => {
    configure({
      paramMap: of({ get: () => null }),
      queryParamMap: of({
        get: (k: string) => (k === 'southType' ? 'opcua-ha' : k === 'northType' ? 'console' : null),
        getAll: () => []
      }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });

    const fixture = TestBed.createComponent(EditHistoryQueryComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  test('should create in edit mode', () => {
    const historyQueryService = configure({
      paramMap: of({ get: (k: string) => (k === 'historyQueryId' ? 'id1' : null) }),
      queryParamMap: of({ get: () => null, getAll: () => [] }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });

    historyQueryService.findById.mockReturnValue(of(testData.historyQueries.list[0] as unknown as HistoryQueryDTO));

    const fixture = TestBed.createComponent(EditHistoryQueryComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
