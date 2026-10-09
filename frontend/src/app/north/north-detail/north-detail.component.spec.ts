import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { LogDTO } from '@oibus/shared/api/logs.model';
import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { CertificateService } from '../../services/certificate.service';
import { EngineService } from '../../services/engine.service';
import { LogService } from '../../services/log.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { METRICS_REFRESH_INTERVAL_MS } from '../../shared/polling';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { emptyPage } from '../../shared/utils/page.utils';
import { NorthDetailComponent } from './north-detail.component';

const manifest: NorthConnectorManifest = {
  ...testData.north.manifest,
  id: 'file-writer',
  settings: {
    ...testData.north.manifest.settings,
    attributes: [
      {
        type: 'string',
        key: 'outputFolder',
        translationKey: 'configuration.oibus.manifest.north.file-writer.output-folder',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'prefix',
        translationKey: 'configuration.oibus.manifest.north.file-writer.prefix',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'suffix',
        translationKey: 'configuration.oibus.manifest.north.file-writer.suffix',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    ],
    enablingConditions: [{ referralPathFromRoot: 'prefix', targetPathFromRoot: 'suffix', values: ['other-prefix'] }]
  }
};

class NorthDetailComponentTester {
  readonly fixture = TestBed.createComponent(NorthDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly settings = this.root.getByCss('tbody.north-settings tr');
  readonly editButton = this.root.getByRole('button', { name: 'Edit north connector' });
  readonly auditButton = this.root.getByRole('button', { name: 'View north connector audit history' });
  readonly stopButton = this.root.getByRole('button', { name: 'Stop north connector' });
  readonly startButton = this.root.getByRole('button', { name: 'Start north connector' });
  readonly testConnectionButton = this.root.getByRole('button', { name: 'Test settings' });
  readonly copyCachePath = this.root.getByRole('button', { name: 'Copy cache path to clipboard' });
  readonly metrics = this.root.getByCss('oib-north-metrics');
  readonly transformers = this.root.getByCss('oib-north-transformers tbody tr');
  readonly cachingRows = this.root.getByCss('oib-box').nth(1).getByCss('tbody tr');
}

describe('NorthDetailComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<AuditHistoryModalComponent | TestConnectionResultModalComponent>;
  let northConnector: NorthConnectorDTO;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);
    const scanModeService = createMock(ScanModeService);
    const certificateService = createMock(CertificateService);
    const transformerService = createMock(TransformerService);
    const southConnectorService = createMock(SouthConnectorService);
    const logService = createMock(LogService);
    const confirmationService = createMock(ConfirmationService);
    confirmationService.confirm.mockReturnValue(of(undefined));
    const engineService = createMock(EngineService, { info$: of(testData.engine.oIBusInfo) });

    northConnector = structuredClone(testData.north.list[0]);
    northConnectorService.findById.mockReturnValue(of(northConnector));
    northConnectorService.getMetrics.mockReturnValue(of(testData.north.metrics));
    northConnectorService.getNorthManifest.mockReturnValue(of(manifest));
    northConnectorService.start.mockReturnValue(of(undefined));
    northConnectorService.stop.mockReturnValue(of(undefined));
    scanModeService.list.mockReturnValue(of(testData.scanMode.list));
    certificateService.list.mockReturnValue(of([]));
    transformerService.list.mockReturnValue(of([]));
    southConnectorService.list.mockReturnValue(of([]));
    logService.search.mockReturnValue(of(emptyPage<LogDTO>()));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([
          { path: 'north/:northId', component: NorthDetailComponent },
          { path: 'north/:northId/edit', component: EmptyRouteComponent }
        ]),
        provideModalTesting(),
        provideCurrentUser(),
        { provide: ActivatedRoute, useValue: stubRoute({ params: { northId: 'northId1' } }) },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService },
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: LogService, useValue: logService },
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  afterEach(() => vi.useRealTimers());

  test('should display the north connector', async () => {
    const tester = new NorthDetailComponentTester();

    await expect.element(tester.title).toHaveTextContent('North North 1');
    expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
    expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('file-writer');
    // status, output folder and prefix (the suffix is not enabled for this prefix)
    await expect.element(tester.settings).toHaveLength(3);
    await expect.element(tester.settings.nth(0)).toHaveTextContent('Statusactive');
    await expect.element(tester.settings.nth(1)).toHaveTextContent('Output folderoutput-folder');
    await expect.element(tester.settings.nth(2)).toHaveTextContent('Prefixprefix-');
    await expect.element(tester.cachingRows.nth(0)).toMatchTextContent(/scanMode1.*250.*1/);
    await expect.element(tester.transformers).toHaveLength(3);
    await expect.element(tester.metrics).toBeInTheDocument();
    await expect.element(tester.stopButton).toBeInTheDocument();
  });

  test('should poll the north connector metrics', async () => {
    vi.useFakeTimers();
    const tester = new NorthDetailComponentTester();
    await vi.waitFor(() => expect(northConnectorService.getMetrics).toHaveBeenCalledTimes(1));
    expect(northConnectorService.getMetrics).toHaveBeenCalledWith('northId1');

    await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
    expect(northConnectorService.getMetrics).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
    expect(northConnectorService.getMetrics).toHaveBeenCalledTimes(3);

    tester.fixture.destroy();
    await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
    expect(northConnectorService.getMetrics).toHaveBeenCalledTimes(3);
  });

  test('should stop the connector', async () => {
    const tester = new NorthDetailComponentTester();
    await expect.element(tester.stopButton).toBeInTheDocument();
    northConnectorService.findById.mockReturnValue(of({ ...northConnector, enabled: false }));

    await tester.stopButton.click();

    expect(northConnectorService.stop).toHaveBeenCalledWith('northId1');
    expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: 'North 1' });
    await expect.element(tester.startButton).toBeInTheDocument();
    await expect.element(tester.settings.nth(0)).toHaveTextContent('Statuspaused');
  });

  test('should start the connector', async () => {
    northConnectorService.findById.mockReturnValue(of({ ...northConnector, enabled: false }));
    const tester = new NorthDetailComponentTester();
    await expect.element(tester.startButton).toBeInTheDocument();
    northConnectorService.findById.mockReturnValue(of(northConnector));

    await tester.startButton.click();

    expect(northConnectorService.start).toHaveBeenCalledWith('northId1');
    expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: 'North 1' });
    await expect.element(tester.stopButton).toBeInTheDocument();
  });

  test('should test the connection', async () => {
    const fakeModal = createMock(TestConnectionResultModalComponent);
    modalService.mockClosedModal(fakeModal);
    const tester = new NorthDetailComponentTester();

    await tester.testConnectionButton.click();

    expect(fakeModal.runTest).toHaveBeenCalledWith('north', 'northId1', northConnector.settings, 'file-writer');
  });

  test('should open the audit history of the north connector', async () => {
    const fakeModal = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeModal);
    const tester = new NorthDetailComponentTester();

    await tester.auditButton.click();

    expect(fakeModal.prepare).toHaveBeenCalledWith('north_connector', 'northId1');
  });

  test('should navigate to the edition', async () => {
    const harness = await RouterTestingHarness.create('/north/northId1');
    const editButton = page.elementLocator(harness.routeNativeElement!).getByRole('button', { name: 'Edit north connector' });

    await editButton.click();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1/edit'));
  });

  test('should copy the cache path', async () => {
    const tester = new NorthDetailComponentTester();
    await expect.element(tester.copyCachePath).toBeInTheDocument();
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);

    await tester.copyCachePath.click();

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(notificationService.success).toHaveBeenCalledWith('north.cache-path-copy.success');
  });

  test('should notify a failed copy of the cache path', async () => {
    const tester = new NorthDetailComponentTester();
    await expect.element(tester.copyCachePath).toBeInTheDocument();
    vi.spyOn(document, 'execCommand').mockReturnValue(false);

    await tester.copyCachePath.click();

    expect(notificationService.error).toHaveBeenCalledWith('north.cache-path-copy.error');
  });

  test('should reload the connector when its transformers change', async () => {
    const tester = new NorthDetailComponentTester();
    await expect.element(tester.transformers).toHaveLength(3);
    northConnectorService.findById.mockReturnValue(of({ ...northConnector, transformers: [] }));
    northConnectorService.removeTransformer.mockReturnValue(of(undefined));

    // deleting a transformer from the embedded list makes the detail page reload the connector
    await tester.transformers.nth(0).getByRole('button', { name: 'Delete transformer' }).click();

    await expect.element(tester.transformers).toHaveLength(0);
    expect(northConnectorService.findById).toHaveBeenCalledTimes(2);
  });
});
