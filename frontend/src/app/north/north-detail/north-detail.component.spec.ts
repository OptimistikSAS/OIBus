import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { LogDTO } from '@oibus/shared/api/logs.model';
import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildEngineSettings } from '../../../test/builders';
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
import { ServerTrustModalComponent } from '../../shared/server-trust/server-trust-modal/server-trust-modal.component';
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
        key: 'password',
        translationKey: 'configuration.oibus.manifest.north.file-writer.smb-password',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'domain',
        translationKey: 'configuration.oibus.manifest.north.file-writer.smb-domain',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    ],
    enablingConditions: [{ referralPathFromRoot: 'password', targetPathFromRoot: 'domain', values: ['other-password'] }]
  }
};

const identity = testData.serverTrust.identities.sshHostKey;
/** The identity trusted before the server presented another one */
const trustedIdentity = testData.serverTrust.trustedIdentities.otherSshHostKey;
const pending = testData.serverTrust.presented.changed;
const { trusted: trustedState, changedRefused: pendingState } = testData.serverTrust.states;

class NorthDetailComponentTester {
  readonly fixture = TestBed.createComponent(NorthDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly settings = this.root.getByCss('#north-settings .oib-summary-entry');
  readonly editButton = this.root.getByRole('button', { name: 'Edit north connector' });
  readonly auditButton = this.root.getByRole('button', { name: 'View north connector audit history' });
  readonly stopButton = this.root.getByRole('button', { name: 'Stop north connector' });
  readonly startButton = this.root.getByRole('button', { name: 'Start north connector' });
  readonly testConnectionButton = this.root.getByRole('button', { name: 'Test settings' });
  readonly copyCachePath = this.root.getByRole('button', { name: 'Copy cache path to clipboard' });
  readonly metrics = this.root.getByCss('oib-north-metrics');
  // the transformers of the sources: without south, only the one of the OIBus API data source
  readonly transformers = this.root.getByCss('oib-north-transformers').getByRole('button', { name: 'Delete transformer' });
  readonly status = this.root.getByCss('#north-status');
  readonly caching = this.root.getByCss('#north-caching .oib-summary-entry');
  readonly serverTrustPanel = this.root.getByCss('oib-server-trust-panel');
  readonly serverNotTrusted = this.root.getByCss('#server-not-trusted-status');
  readonly reviewServerIdentityButton = this.root.getByRole('button', { name: 'Review and trust' });
}

describe('NorthDetailComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<AuditHistoryModalComponent | TestConnectionResultModalComponent | ServerTrustModalComponent>;
  let northConnector: NorthConnectorDTO;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);
    const scanModeService = createMock(ScanModeService, { created: signal([]) });
    const certificateService = createMock(CertificateService, { created: signal([]) });
    const transformerService = createMock(TransformerService);
    const southConnectorService = createMock(SouthConnectorService);
    const logService = createMock(LogService);
    const confirmationService = createMock(ConfirmationService);
    confirmationService.confirm.mockReturnValue(of(undefined));
    const engineService = createMock(EngineService, { info$: of(testData.engine.oIBusInfo) });
    const engineSettings = buildEngineSettings();
    engineService.getEngineSettings.mockReturnValue(
      of({ ...engineSettings, webServer: { ...engineSettings.webServer, enableContentEndpoint: true } })
    );
    engineService.getRegistrationSettings.mockReturnValue(of(testData.oIAnalytics.registration.completed));

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

    await expect.element(tester.title).toHaveTextContent('North 1');
    await expect.element(tester.status).toHaveTextContent('Enabled');
    expect(northConnectorService.findById).toHaveBeenCalledWith('northId1');
    expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('file-writer');
    // output folder and password (the domain is not enabled for this password)
    await expect.element(tester.settings).toHaveLength(2);
    await expect.element(tester.settings.nth(0)).toHaveTextContent('Output folder output-folder');
    await expect.element(tester.settings.nth(1)).toHaveTextContent('SMB password–');
    await expect.element(tester.caching.nth(0)).toHaveTextContent('Schedule scanMode1');
    await expect.element(tester.caching.nth(1)).toHaveTextContent('Number of elements 250');
    await expect.element(tester.transformers).toHaveLength(1);
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
    await expect.element(tester.status).toHaveTextContent('Disabled');
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
    await expect.element(tester.transformers).toHaveLength(1);
    northConnectorService.findById.mockReturnValue(of({ ...northConnector, transformers: [] }));
    northConnectorService.removeTransformer.mockReturnValue(of(undefined));

    // deleting a transformer from the embedded list makes the detail page reload the connector
    await tester.transformers.nth(0).click();

    await expect.element(tester.transformers).toHaveLength(0);
    expect(northConnectorService.findById).toHaveBeenCalledTimes(2);
  });

  describe('server identity', () => {
    let trustModal: MockObject<ServerTrustModalComponent>;

    beforeEach(() => {
      northConnectorService.getNorthManifest.mockReturnValue(of({ ...manifest, serverIdentity: 'ssh-host-key' }));
      northConnectorService.getServerTrust.mockReturnValue(of(trustedState));
      northConnectorService.trustServerIdentity.mockReturnValue(of(undefined));
      trustModal = createMock(ServerTrustModalComponent);
    });

    test('should poll the trust of the connector in the identity of its server', async () => {
      vi.useFakeTimers();
      const tester = new NorthDetailComponentTester();
      await vi.waitFor(() => expect(northConnectorService.getServerTrust).toHaveBeenCalledTimes(1));
      expect(northConnectorService.getServerTrust).toHaveBeenCalledWith('northId1');

      await expect.element(tester.serverTrustPanel).toMatchTextContent(/Identity of the server\s*Trusted by Admin on/);
      await expect.element(tester.serverNotTrusted).not.toBeInTheDocument();
      await expect.element(tester.reviewServerIdentityButton).not.toBeInTheDocument();

      northConnectorService.getServerTrust.mockReturnValue(of(pendingState));
      await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
      expect(northConnectorService.getServerTrust).toHaveBeenCalledTimes(2);
      await expect.element(tester.serverNotTrusted).toHaveTextContent('Server not trusted');

      tester.fixture.destroy();
      await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);
      expect(northConnectorService.getServerTrust).toHaveBeenCalledTimes(2);
    });

    test('should show that the server is not trusted when the connector refused its identity', async () => {
      northConnectorService.getServerTrust.mockReturnValue(of(pendingState));
      const tester = new NorthDetailComponentTester();

      await expect.element(tester.serverNotTrusted).toHaveTextContent('Server not trusted');
      await expect
        .element(
          tester.serverTrustPanel.getByText('The connector refused to connect: its server presents another identity than the one trusted.')
        )
        .toBeVisible();
      await expect.element(tester.reviewServerIdentityButton).toBeVisible();
    });

    test('should review and trust the identity the connector refused', async () => {
      northConnectorService.getServerTrust.mockReturnValue(of(pendingState));
      modalService.mockClosedModal(trustModal, 'trust');
      const tester = new NorthDetailComponentTester();
      await expect.element(tester.serverNotTrusted).toBeInTheDocument();
      northConnectorService.getServerTrust.mockReturnValue(of(trustedState));

      await tester.reviewServerIdentityButton.click();

      expect(trustModal.prepare).toHaveBeenCalledWith('review', pending, trustedIdentity);
      expect(northConnectorService.trustServerIdentity).toHaveBeenCalledWith('northId1', identity.fingerprint);
      expect(notificationService.success).toHaveBeenCalledWith('server-trust.trusted', { name: 'North 1' });
      // the trust and the connector are read again
      await expect.element(tester.serverNotTrusted).not.toBeInTheDocument();
      expect(northConnectorService.getServerTrust).toHaveBeenCalledTimes(2);
      expect(northConnectorService.findById).toHaveBeenCalledTimes(2);
    });

    test('should not trust the identity the connector refused when the review is cancelled', async () => {
      northConnectorService.getServerTrust.mockReturnValue(of(pendingState));
      modalService.mockDismissedModal(trustModal);
      const tester = new NorthDetailComponentTester();

      await tester.reviewServerIdentityButton.click();

      expect(trustModal.prepare).toHaveBeenCalled();
      expect(northConnectorService.trustServerIdentity).not.toHaveBeenCalled();
      await expect.element(tester.serverNotTrusted).toBeInTheDocument();
    });

    test('should trust the identity of the server from the connection test', async () => {
      northConnector.serverTrust = { identity: trustedIdentity, trustOnFirstUse: false };
      const testModal = createMock(TestConnectionResultModalComponent);
      modalService.mockClosedModal(testModal);
      const tester = new NorthDetailComponentTester();

      await tester.testConnectionButton.click();

      expect(testModal.runTest).toHaveBeenCalledWith('north', 'northId1', northConnector.settings, 'file-writer');
      const options = testModal.allowServerTrust.mock.lastCall![0];
      expect(options.trusted).toEqual(trustedIdentity);
      await firstValueFrom(options.trust(identity));
      expect(northConnectorService.trustServerIdentity).toHaveBeenCalledWith('northId1', identity.fingerprint);
      expect(notificationService.success).toHaveBeenCalledWith('server-trust.trusted', { name: 'North 1' });
      expect(northConnectorService.findById).toHaveBeenCalledTimes(2);
    });

    describe('start', () => {
      beforeEach(() => {
        northConnectorService.findById.mockReturnValue(of({ ...northConnector, enabled: false }));
        northConnectorService.retrieveServerIdentity.mockReturnValue(of(pending));
      });

      test('should trust the identity of the server before starting the connector', async () => {
        modalService.mockClosedModal(trustModal, 'trust');
        const tester = new NorthDetailComponentTester();
        await expect.element(tester.startButton).toBeInTheDocument();

        await tester.startButton.click();

        expect(northConnectorService.retrieveServerIdentity).toHaveBeenCalledWith('northId1', northConnector.settings, 'file-writer');
        expect(trustModal.prepare).toHaveBeenCalledWith('start', pending, null);
        expect(northConnectorService.trustServerIdentity).toHaveBeenCalledWith('northId1', identity.fingerprint);
        expect(northConnectorService.start).toHaveBeenCalledWith('northId1');
        expect(northConnectorService.trustServerIdentity.mock.invocationCallOrder[0]).toBeLessThan(
          northConnectorService.start.mock.invocationCallOrder[0]
        );
        expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: 'North 1' });
      });

      test('should start the connector without trusting the identity of its server', async () => {
        modalService.mockClosedModal(trustModal, 'skip');
        const tester = new NorthDetailComponentTester();
        await expect.element(tester.startButton).toBeInTheDocument();

        await tester.startButton.click();

        expect(trustModal.prepare).toHaveBeenCalled();
        expect(northConnectorService.trustServerIdentity).not.toHaveBeenCalled();
        expect(northConnectorService.start).toHaveBeenCalledWith('northId1');
      });

      test('should not start the connector when the review of the identity of its server is cancelled', async () => {
        modalService.mockDismissedModal(trustModal);
        const tester = new NorthDetailComponentTester();
        await expect.element(tester.startButton).toBeInTheDocument();

        await tester.startButton.click();

        expect(trustModal.prepare).toHaveBeenCalled();
        expect(northConnectorService.trustServerIdentity).not.toHaveBeenCalled();
        expect(northConnectorService.start).not.toHaveBeenCalled();
      });

      test('should start the connector directly when the identity of its server is trusted', async () => {
        northConnectorService.retrieveServerIdentity.mockReturnValue(of(testData.serverTrust.presented.trusted));
        const tester = new NorthDetailComponentTester();
        await expect.element(tester.startButton).toBeInTheDocument();

        // no modal is set up: opening one would fail
        await tester.startButton.click();

        expect(northConnectorService.trustServerIdentity).not.toHaveBeenCalled();
        expect(northConnectorService.start).toHaveBeenCalledWith('northId1');
      });
    });
  });

  test('should not check the identity of the server when the connector does not', async () => {
    northConnectorService.findById.mockReturnValue(of({ ...northConnector, enabled: false }));
    const testModal = createMock(TestConnectionResultModalComponent);
    modalService.mockClosedModal(testModal);
    const tester = new NorthDetailComponentTester();
    await expect.element(tester.startButton).toBeInTheDocument();

    await tester.testConnectionButton.click();
    await tester.startButton.click();

    expect(testModal.allowServerTrust).not.toHaveBeenCalled();
    expect(northConnectorService.retrieveServerIdentity).not.toHaveBeenCalled();
    expect(northConnectorService.start).toHaveBeenCalledWith('northId1');
    expect(northConnectorService.getServerTrust).not.toHaveBeenCalled();
    await expect.element(tester.serverTrustPanel).not.toBeInTheDocument();
  });
});
