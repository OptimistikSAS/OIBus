import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { EngineMetricsComponent } from './engine-metrics.component';
import { Component } from '@angular/core';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { EngineService } from '../../services/engine.service';

@Component({
  template: `<oib-engine-metrics></oib-engine-metrics>`,
  standalone: true,
  imports: [EngineMetricsComponent]
})
class TestComponent {}

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
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new EngineMetricsComponentTester();
  });

  it('should not have a title', () => {
    tester.detectChanges();
    expect(tester.title).toBeNull();
  });
});
