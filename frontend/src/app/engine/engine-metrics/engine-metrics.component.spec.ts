import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { EngineMetricsComponent } from './engine-metrics.component';
import { Component } from '@angular/core';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EngineService } from '../../services/engine.service';
import { EngineMetrics } from '../../../../../shared/model/engine.model';
import { provideHttpClient } from '@angular/common/http';

@Component({
  template: `<oib-engine-metrics [metrics]="metrics"></oib-engine-metrics>`,
  standalone: true,
  imports: [EngineMetricsComponent]
})
class TestComponent {
  metrics: EngineMetrics = {
    metricsStart: '2020-02-02T00:00:00.000Z',
    processCpuUsageInstant: 11,
    processCpuUsageAverage: 12,
    processUptime: 13
  } as EngineMetrics;
}

class EngineMetricsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }
}

describe('EngineMetricsComponent', () => {
  let tester: EngineMetricsComponentTester;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    const engineService = createMock(EngineService);
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new EngineMetricsComponentTester();
  });

  it('should not have a title', () => {
    tester.detectChanges();
    expect(tester.title).toContainText('Metrics');
  });
});
