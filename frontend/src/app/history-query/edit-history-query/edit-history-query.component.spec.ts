import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, expect, test, vi } from 'vitest';

import { EditHistoryQueryComponent } from './edit-history-query.component';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
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

function configure(activatedRouteValue: object): {
  historyQueryService: MockObject<HistoryQueryService>;
  modalService: MockObject<ModalService>;
} {
  const historyQueryService = createMock(HistoryQueryService);
  const northConnectorService = createMock(NorthConnectorService);
  const southConnectorService = createMock(SouthConnectorService);
  const scanModeService = createMock(ScanModeService);
  const certificateService = createMock(CertificateService);
  const transformerService = createMock(TransformerService);
  const modalService = createMock(ModalService);

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
      { provide: ModalService, useValue: modalService },
      { provide: UnsavedChangesConfirmationService, useValue: createMock(UnsavedChangesConfirmationService) },
      { provide: ConfirmationService, useValue: createMock(ConfirmationService) }
    ]
  });

  return { historyQueryService, modalService };
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
    const { historyQueryService } = configure({
      paramMap: of({ get: (k: string) => (k === 'historyQueryId' ? 'id1' : null) }),
      queryParamMap: of({ get: () => null, getAll: () => [] }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });

    historyQueryService.findById.mockReturnValue(of(testData.historyQueries.list[0] as unknown as HistoryQueryDTO));

    const fixture = TestBed.createComponent(EditHistoryQueryComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  test('should show the explore button when the south manifest supports exploration', async () => {
    const { historyQueryService } = configure({
      paramMap: of({ get: (k: string) => (k === 'historyQueryId' ? 'id1' : null) }),
      queryParamMap: of({ get: () => null, getAll: () => [] }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });
    historyQueryService.findById.mockReturnValue(of(testData.historyQueries.list[0] as unknown as HistoryQueryDTO));

    const fixture = TestBed.createComponent(EditHistoryQueryComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#explore')).toBeInTheDocument();
  });

  test('explore should open the explore modal wired to the history query explore endpoints, in edit mode', () => {
    const { historyQueryService, modalService } = configure({
      paramMap: of({ get: (k: string) => (k === 'historyQueryId' ? 'id1' : null) }),
      queryParamMap: of({ get: () => null, getAll: () => [] }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });
    const historyQuery = testData.historyQueries.list[0] as unknown as HistoryQueryDTO;
    historyQueryService.findById.mockReturnValue(of(historyQuery));
    historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    historyQueryService.browseExplore.mockReturnValue(of({ entries: [] }));
    historyQueryService.closeExplore.mockReturnValue(of(undefined));
    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare } } as any);

    const fixture = TestBed.createComponent(EditHistoryQueryComponent);
    fixture.detectChanges();

    const southCommand = fixture.componentInstance.southConnectorCommand;
    fixture.componentInstance.explore();

    expect(modalService.open).toHaveBeenCalledWith(SouthExploreModalComponent, { size: 'lg' });
    expect(prepare).toHaveBeenCalledWith(
      historyQuery.id,
      southCommand.settings,
      southCommand.type,
      expect.objectContaining({ start: expect.any(Function), browse: expect.any(Function), close: expect.any(Function) })
    );

    const api = prepare.mock.calls[0][3];
    api.start(southCommand.settings, southCommand.type);
    expect(historyQueryService.startExplore).toHaveBeenCalledWith(historyQuery.id, southCommand.settings, southCommand.type, null);

    api.browse('sessionId', null);
    expect(historyQueryService.browseExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId', null);

    api.close('sessionId');
    expect(historyQueryService.closeExplore).toHaveBeenCalledWith(historyQuery.id, 'sessionId');
  });

  test('explore should target "create" and pass the source south id, when creating from an existing south connector', () => {
    const { historyQueryService, modalService } = configure({
      paramMap: of({ get: () => null }),
      queryParamMap: of({
        get: (k: string) => (k === 'southId' ? 'south1' : null),
        getAll: () => []
      }),
      snapshot: { queryParamMap: { get: () => null, getAll: () => [] } }
    });
    const southConnector = testData.south.list[0];
    const southConnectorService = TestBed.inject(SouthConnectorService) as unknown as MockObject<SouthConnectorService>;
    southConnectorService.findById.mockReturnValue(of(southConnector as any));
    historyQueryService.startExplore.mockReturnValue(of({ sessionId: 'sessionId', entries: [] }));
    const prepare = vi.fn();
    modalService.open.mockReturnValue({ componentInstance: { prepare } } as any);

    const fixture = TestBed.createComponent(EditHistoryQueryComponent);
    fixture.detectChanges();

    const southCommand = fixture.componentInstance.southConnectorCommand;
    fixture.componentInstance.explore();

    expect(prepare).toHaveBeenCalledWith(
      null,
      southCommand.settings,
      southCommand.type,
      expect.objectContaining({ start: expect.any(Function) })
    );
    const api = prepare.mock.calls[0][3];
    api.start(southCommand.settings, southCommand.type);
    expect(historyQueryService.startExplore).toHaveBeenCalledWith('create', southCommand.settings, southCommand.type, southConnector.id);
  });
});
