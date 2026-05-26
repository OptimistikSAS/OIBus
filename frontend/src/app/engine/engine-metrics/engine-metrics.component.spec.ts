import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideRouter } from '@angular/router';

import { EngineMetricsComponent } from './engine-metrics.component';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineMetrics } from '../../../../../backend/shared/model/engine.model';

const metrics: EngineMetrics = {
  processCpuUsageInstant: 1.5,
  processCpuUsageAverage: 2.0,
  processUptime: 3600,
  freeMemory: 1024 * 1024 * 100,
  totalMemory: 1024 * 1024 * 1000,
  minRss: 1024 * 1024 * 50,
  currentRss: 1024 * 1024 * 60,
  maxRss: 1024 * 1024 * 70,
  currentHeapTotal: 1024 * 1024 * 30,
  maxHeapTotal: 1024 * 1024 * 40,
  currentHeapUsed: 1024 * 1024 * 20,
  maxHeapUsed: 1024 * 1024 * 25,
  currentExternal: 1024 * 1024 * 5,
  maxExternal: 1024 * 1024 * 6,
  currentArrayBuffers: 1024,
  maxArrayBuffers: 2048,
  connectorMetrics: {},
  metricsStart: '2020-01-01T00:00:00.000Z'
} as unknown as EngineMetrics;

describe('EngineMetricsComponent', () => {
  let engineService: MockObject<EngineService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display metrics', async () => {
    const fixture = TestBed.createComponent(EngineMetricsComponent);
    fixture.componentRef.setInput('metrics', metrics);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root).toBeInTheDocument();
  });

  test('should reset metrics', () => {
    engineService.resetEngineMetrics.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(EngineMetricsComponent);
    fixture.componentRef.setInput('metrics', metrics);
    fixture.detectChanges();

    fixture.componentInstance.resetMetrics();

    expect(engineService.resetEngineMetrics).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.monitoring.metrics-reset');
  });
});
