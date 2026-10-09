import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';
import { NorthConnectorMetrics } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../services/north-connector.service';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { NotificationService } from '../../shared/notification.service';
import { NorthMetricsComponent } from './north-metrics.component';

class NorthMetricsComponentTester {
  readonly fixture = TestBed.createComponent(NorthMetricsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly rows = this.root.getByCss('tbody tr');
  readonly resetButton = this.root.getByRole('button', { name: 'Reset metrics' });
  readonly displayLink = this.root.getByRole('button', { name: 'View north connector metrics' });

  constructor(options: { manifest?: NorthConnectorManifest | null; displayButton?: boolean; metrics?: NorthConnectorMetrics } = {}) {
    this.fixture.componentRef.setInput('northConnector', testData.north.listLight[0]);
    this.fixture.componentRef.setInput('connectorMetrics', options.metrics ?? testData.north.metrics);
    if (options.manifest !== undefined) {
      this.fixture.componentRef.setInput('manifest', options.manifest);
    }
    if (options.displayButton !== undefined) {
      this.fixture.componentRef.setInput('displayButton', options.displayButton);
    }
  }
}

describe('NorthMetricsComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'north/:northId', component: EmptyRouteComponent }]),
        provideCurrentUser(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display the metrics with the given manifest', async () => {
    const tester = new NorthMetricsComponentTester({ manifest: testData.north.manifest });

    await expect.element(tester.title).toHaveTextContent('North 1 metrics');
    // no last connection, last content sent nor last run in the fixture
    await expect.element(tester.rows).toHaveLength(3);
    await expect.element(tester.rows.nth(0)).toHaveTextContent('Cache sizeCurrent size: 10 B / Total cached: 22 B / Total sent: 11 B');
    await expect.element(tester.rows.nth(1)).toHaveTextContent('Error sizeCurrent size: 20 B / Total errored: 23 B');
    await expect.element(tester.rows.nth(2)).toHaveTextContent('Archive sizeCurrent size: 30 B / Total archived: 24 B');
    expect(northConnectorService.getNorthManifest).not.toHaveBeenCalled();
  });

  test('should display the optional metrics', async () => {
    const tester = new NorthMetricsComponentTester({
      manifest: testData.north.manifest,
      metrics: {
        ...testData.north.metrics,
        lastConnection: '2020-03-15T10:00:00.000Z',
        lastContentSent: 'file.csv',
        lastRunStart: '2020-03-15T11:00:00.000Z',
        lastRunDuration: 2000
      }
    });

    await expect.element(tester.rows).toHaveLength(6);
    await expect.element(tester.rows.nth(0)).toMatchTextContent(/^Last connection.*2020/);
    await expect.element(tester.rows.nth(1)).toMatchTextContent('Last content sentfile.csv');
    await expect.element(tester.rows.nth(2)).toMatchTextContent(/Last run.*\(in 2 s\)/);
  });

  test('should fetch the manifest of the connector type when none is given', async () => {
    const manifest$ = new Subject<NorthConnectorManifest>();
    northConnectorService.getNorthManifest.mockReturnValue(manifest$);
    const tester = new NorthMetricsComponentTester();

    await vi.waitFor(() => expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith('file-writer'));
    await expect.element(tester.title).not.toBeInTheDocument();

    manifest$.next(testData.north.manifest);

    await expect.element(tester.title).toHaveTextContent('North 1 metrics');
  });

  test('should reset the metrics', async () => {
    northConnectorService.resetMetrics.mockReturnValue(of(undefined));
    const tester = new NorthMetricsComponentTester({ manifest: testData.north.manifest });
    await expect.element(tester.displayLink).not.toBeInTheDocument();

    await tester.resetButton.click();

    expect(northConnectorService.resetMetrics).toHaveBeenCalledWith('northId1');
    expect(notificationService.success).toHaveBeenCalledWith('north.monitoring.metrics-reset');
  });

  test('should navigate to the connector when the display button is shown', async () => {
    const tester = new NorthMetricsComponentTester({ manifest: testData.north.manifest, displayButton: true });
    await expect.element(tester.resetButton).not.toBeInTheDocument();

    await tester.displayLink.click();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1'));
  });

  test('should navigate to the connector with the keyboard', async () => {
    const tester = new NorthMetricsComponentTester({ manifest: testData.north.manifest, displayButton: true });
    await expect.element(tester.displayLink).toBeInTheDocument();

    tester.displayLink.element().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/north/northId1'));
  });
});
