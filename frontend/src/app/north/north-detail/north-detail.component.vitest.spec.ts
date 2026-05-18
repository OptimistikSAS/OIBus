import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, test } from 'vitest';

import { NorthDetailComponent } from './north-detail.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { CertificateService } from '../../services/certificate.service';
import { TransformerService } from '../../services/transformer.service';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { ModalService } from '../../shared/modal.service';
import { WindowService } from '../../shared/window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { OIBusInfo } from '../../../../../backend/shared/model/engine.model';

describe('NorthDetailComponent', () => {
  beforeEach(() => {
    const northConnectorService = createMock(NorthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);
    const engineService = createMock(EngineService);

    northConnectorService.findById.mockReturnValue(of(testData.north.list[0] as unknown as NorthConnectorDTO));
    // Return null to skip connectToEventSource() — the subscribe callback exits early when manifest is null
    northConnectorService.getNorthManifest.mockReturnValue(of(null as unknown as NorthConnectorManifest));
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
            paramMap: of({ get: (key: string) => (key === 'northId' ? 'id1' : null) }),
            queryParamMap: of({ get: () => null, getAll: () => [] }),
            snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
          }
        },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ModalService, useValue: createMock(ModalService) },
        { provide: WindowService, useValue: createMock(WindowService) }
      ]
    });
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(NorthDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
