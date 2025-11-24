import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { SouthMetricsComponent } from './south-metrics.component';
import { Component } from '@angular/core';
import { NotificationService } from '../../../shared/notification.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthConnectorMetrics } from '../../../../../../backend/shared/model/engine.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

@Component({
  selector: 'test-south-metrics-component',
  template: ` <oib-south-metrics [connectorMetrics]="metrics" [southConnector]="southConnector" [manifest]="manifest" />`,
  imports: [SouthMetricsComponent]
})
class TestComponent {
  metrics: SouthConnectorMetrics = testData.south.metrics;
  southConnector = testData.south.list[0];
  manifest = testData.south.manifest;
}

class SouthDataComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }
}

describe('SouthMetricsComponent', () => {
  let tester: SouthDataComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    notificationService = createMock(NotificationService);
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new SouthDataComponentTester();
  });

  it('should have a title', async () => {
    await tester.change();
    expect(tester.title).toContainText('South 1 metrics');
  });
});
