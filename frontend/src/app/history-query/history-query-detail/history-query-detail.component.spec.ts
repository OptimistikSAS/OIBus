import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { HistoryQueryDetailComponent } from './history-query-detail.component';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
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
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { OIBusInfo } from '../../../../../backend/shared/model/engine.model';

// Deep-cloned: `testData` fixtures share object references across entities (e.g. multiple
// connectors point at the same `scanModes[0]` instance), so holding a live reference here makes
// this suite vulnerable to mutations performed by unrelated spec files sharing the same module
// instance under Vitest's browser-mode test runner.
const historyQuery: HistoryQueryDTO = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));

describe('HistoryQueryDetailComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);
    const engineService = createMock(EngineService);
    modalService = createMock(ModalService);

    historyQueryService.findById.mockReturnValue(of(historyQuery as unknown as HistoryQueryDTO));
    // Return null for both manifests — subscribe callback exits early via `if (!northManifest || !southManifest) return`
    // This prevents connectToEventSource() from being called in tests
    northConnectorService.getNorthManifest.mockReturnValue(of(null as unknown as NorthConnectorManifest));
    southConnectorService.getSouthManifest.mockReturnValue(of(null as unknown as SouthConnectorManifest));
    (engineService as any).info$ = of(testData.engine.oIBusInfo as unknown as OIBusInfo);
    scanModeService.list.mockReturnValue(of([]));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));

    function MockEventSource(this: { addEventListener: () => void; close: () => void }) {
      this.addEventListener = vi.fn();
      this.close = vi.fn();
    }
    Object.defineProperty(window, 'EventSource', {
      value: MockEventSource,
      writable: true,
      configurable: true
    });

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
        { provide: ModalService, useValue: modalService },
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

  test('should show the explore button when the south manifest supports exploration', async () => {
    northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
    southConnectorService.getSouthManifest.mockReturnValue(of({ ...testData.south.manifest, explore: true }));
    const fixture = TestBed.createComponent(HistoryQueryDetailComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#explore')).toBeInTheDocument();
  });

  test('should hide the explore button when the south manifest does not support exploration', async () => {
    northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
    southConnectorService.getSouthManifest.mockReturnValue(of({ ...testData.south.manifest, explore: false }));
    const fixture = TestBed.createComponent(HistoryQueryDetailComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#explore')).not.toBeInTheDocument();
  });

  test('explore should open the explore modal wired to the history query explore endpoints', () => {
    northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
    southConnectorService.getSouthManifest.mockReturnValue(of({ ...testData.south.manifest, explore: true }));
    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare } } as any);
    historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    historyQueryService.browseExplore.mockReturnValue(of({ entries: [] }));
    historyQueryService.closeExplore.mockReturnValue(of(undefined));

    const fixture = TestBed.createComponent(HistoryQueryDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.explore();

    expect(modalService.open).toHaveBeenCalledWith(SouthExploreModalComponent, { size: 'lg' });
    expect(prepare).toHaveBeenCalledWith(
      historyQuery.id,
      historyQuery.southSettings,
      historyQuery.southType,
      { ...testData.south.manifest, explore: true },
      expect.objectContaining({ start: expect.any(Function), browse: expect.any(Function), close: expect.any(Function) }),
      historyQuery.items,
      { checkFn: expect.any(Function), importFn: expect.any(Function) }
    );

    const api = prepare.mock.calls[0][4];
    api.start(historyQuery.southSettings, historyQuery.southType);
    expect(historyQueryService.startExplore).toHaveBeenCalledWith(historyQuery.id, historyQuery.southSettings, historyQuery.southType);

    api.browse('sessionId', null);
    expect(historyQueryService.browseExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId', null);

    api.close('sessionId');
    expect(historyQueryService.closeExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId');
  });
});
