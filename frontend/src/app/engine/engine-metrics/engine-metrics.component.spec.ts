import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { EngineMetricsComponent } from './engine-metrics.component';
import { Component } from '@angular/core';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EngineService } from '../../services/engine.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { provideHttpClientTesting } from '@angular/common/http/testing';

@Component({
  selector: 'oib-test-engine-metrics-component',
  template: ` <oib-engine-metrics [metrics]="metrics" />`,
  imports: [EngineMetricsComponent]
})
class TestComponent {
  metrics = testData.engine.metrics;
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

  beforeEach(() => {
    const engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new EngineMetricsComponentTester();
  });

  it('should not have a title', async () => {
    await tester.change();
    expect(tester.title).toContainText('Metrics');
  });
});
