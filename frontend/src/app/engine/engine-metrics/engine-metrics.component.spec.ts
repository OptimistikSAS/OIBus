import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { EngineMetrics } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineMetricsComponent } from './engine-metrics.component';

const MB = 1024 * 1024;
const metrics: EngineMetrics = {
  ...testData.engine.metrics,
  processCpuUsageInstant: 0.015,
  processCpuUsageAverage: 0.02,
  processUptime: 3_600_000,
  freeMemory: 100 * MB,
  totalMemory: 1000 * MB,
  minRss: 50 * MB,
  currentRss: 60 * MB,
  maxRss: 70 * MB
};

class EngineMetricsComponentTester {
  readonly fixture = TestBed.createComponent(EngineMetricsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly resetButton = this.root.getByRole('button', { name: 'Reset metrics' });
  readonly displayLink = this.root.getByLabelText('View engine metrics');

  constructor(displayButton = false) {
    this.fixture.componentRef.setInput('metrics', metrics);
    this.fixture.componentRef.setInput('displayButton', displayButton);
  }
}

describe('EngineMetricsComponent', () => {
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'engine', component: EmptyRouteComponent }]),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display metrics', async () => {
    const tester = new EngineMetricsComponentTester();

    await expect.element(tester.root).toMatchTextContent('Metrics');
    await expect.element(tester.root).toMatchTextContent('since 1 Jan 2020');
    await expect.element(tester.rows).toHaveLength(9);
    await expect.element(tester.rows.nth(0)).toMatchTextContent('CPU usage (last second)1.50%');
    await expect.element(tester.rows.nth(1)).toMatchTextContent('CPU usage (average)2.00%');
    await expect.element(tester.rows.nth(2)).toMatchTextContent('Uptime1 hour');
    await expect.element(tester.rows.nth(3)).toMatchTextContent('Free memory10%');
    await expect.element(tester.rows.nth(4)).toMatchTextContent('50.0 MB / 60.0 MB / 70.0 MB');
  });

  test('should reset metrics', async () => {
    engineService.resetEngineMetrics.mockReturnValue(of(undefined));
    const tester = new EngineMetricsComponentTester();

    await tester.resetButton.click();

    expect(engineService.resetEngineMetrics).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.monitoring.metrics-reset');
  });

  test('should display a link to the engine metrics instead of the reset button', async () => {
    const tester = new EngineMetricsComponentTester(true);

    await expect.element(tester.resetButton).not.toBeInTheDocument();
    await tester.displayLink.click();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/engine'));
  });
});
