import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthConnectorMetrics } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../../test/empty-route.component';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { NotificationService } from '../../../shared/notification.service';
import { SouthMetricsComponent } from './south-metrics.component';

class SouthMetricsComponentTester {
  readonly fixture = TestBed.createComponent(SouthMetricsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly rows = this.root.getByCss('tbody tr');
  readonly resetButton = this.root.getByRole('button', { name: 'Reset metrics' });
  readonly displayButton = this.root.getByRole('button', { name: 'View south connector metrics' });

  constructor(options: { manifest?: SouthConnectorManifest | null; displayButton?: boolean; metrics?: SouthConnectorMetrics } = {}) {
    this.fixture.componentRef.setInput('southConnector', testData.south.listLight[0]);
    this.fixture.componentRef.setInput('connectorMetrics', options.metrics ?? testData.south.metrics);
    if (options.manifest !== undefined) {
      this.fixture.componentRef.setInput('manifest', options.manifest);
    }
    if (options.displayButton !== undefined) {
      this.fixture.componentRef.setInput('displayButton', options.displayButton);
    }
  }
}

describe('SouthMetricsComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'south/:southId', component: EmptyRouteComponent }]),
        provideCurrentUser(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display the metrics with the given manifest', async () => {
    const tester = new SouthMetricsComponentTester({ manifest: testData.south.manifest });

    await expect.element(tester.title).toHaveTextContent('South 1 metrics');
    // no last connection, value, file nor run in the fixture
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.rows.nth(0)).toHaveTextContent('Number of values retrieved11');
    await expect.element(tester.rows.nth(1)).toHaveTextContent('Number of files retrieved11');
    expect(southConnectorService.getSouthManifest).not.toHaveBeenCalled();
  });

  test('should display the optional metrics', async () => {
    const tester = new SouthMetricsComponentTester({
      manifest: testData.south.manifest,
      metrics: {
        ...testData.south.metrics,
        numberOfValuesRetrieved: 0,
        numberOfFilesRetrieved: 0,
        lastConnection: '2020-03-15T10:00:00.000Z',
        lastValueRetrieved: { pointId: 'point1', timestamp: '2020-03-15T10:30:00.000Z', data: { value: '12' } },
        lastFileRetrieved: 'file.csv',
        lastRunStart: '2020-03-15T11:00:00.000Z',
        lastRunDuration: 2000
      }
    });

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.rows.nth(0)).toMatchTextContent('Last connection');
    await expect.element(tester.rows.nth(1)).toMatchTextContent(/Last value retrievedpoint1 at 2020-03-15T10:30:00.000Z with content/);
    await expect.element(tester.rows.nth(1)).toMatchTextContent('"value": "12"');
    await expect.element(tester.rows.nth(2)).toHaveTextContent('Last file retrievedfile.csv');
    await expect.element(tester.rows.nth(3)).toMatchTextContent('Last run');
    await expect.element(tester.rows.nth(4)).toMatchTextContent('Last run duration');
  });

  test('should fetch the manifest of the connector type when none is given', async () => {
    const manifest$ = new Subject<SouthConnectorManifest>();
    southConnectorService.getSouthManifest.mockReturnValue(manifest$);
    const tester = new SouthMetricsComponentTester();

    await vi.waitFor(() => expect(southConnectorService.getSouthManifest).toHaveBeenCalledWith('folder-scanner'));
    await expect.element(tester.title).not.toBeInTheDocument();

    manifest$.next(testData.south.manifest);

    await expect.element(tester.title).toHaveTextContent('South 1 metrics');
  });

  test('should reset the metrics', async () => {
    southConnectorService.resetMetrics.mockReturnValue(of(undefined));
    const tester = new SouthMetricsComponentTester({ manifest: testData.south.manifest });
    await expect.element(tester.displayButton).not.toBeInTheDocument();

    await tester.resetButton.click();

    expect(southConnectorService.resetMetrics).toHaveBeenCalledWith('southId1');
    expect(notificationService.success).toHaveBeenCalledWith('south.monitoring.metrics-reset');
  });

  test('should navigate to the connector when the display button is shown', async () => {
    const tester = new SouthMetricsComponentTester({ manifest: testData.south.manifest, displayButton: true });
    await expect.element(tester.resetButton).not.toBeInTheDocument();

    await tester.displayButton.click();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/south/southId1'));
  });
});
