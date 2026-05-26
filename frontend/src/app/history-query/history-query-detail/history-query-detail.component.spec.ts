import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, test } from 'vitest';

import { HistoryQueryDetailComponent } from './history-query-detail.component';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { WindowService } from '../../shared/window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { OIBusInfo } from '../../../../../backend/shared/model/engine.model';

describe('HistoryQueryDetailComponent', () => {
  beforeEach(() => {
    const historyQueryService = createMock(HistoryQueryService);
    const northConnectorService = createMock(NorthConnectorService);
    const southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);
    const engineService = createMock(EngineService);

    historyQueryService.findById.mockReturnValue(of(testData.historyQueries.list[0] as unknown as HistoryQueryDTO));
    // Return null for both manifests — subscribe callback exits early via `if (!northManifest || !southManifest) return`
    // This prevents connectToEventSource() from being called in tests
    northConnectorService.getNorthManifest.mockReturnValue(of(null as unknown as NorthConnectorManifest));
    southConnectorService.getSouthManifest.mockReturnValue(of(null as unknown as SouthConnectorManifest));
    (engineService as any).info$ = of(testData.engine.oIBusInfo as unknown as OIBusInfo);
    scanModeService.list.mockReturnValue(of([]));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'historyQueryId' ? 'id1' : null) }),
            queryParamMap: of({ get: () => null, getAll: () => [] }),
            snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
          }
        },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: WindowService, useValue: createMock(WindowService) }
      ]
    });
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(HistoryQueryDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
