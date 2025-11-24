import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthMetricsComponent } from './north-metrics.component';
import { Component } from '@angular/core';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NotificationService } from '../../shared/notification.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../../../backend/src/tests/utils/test-data';

@Component({
  selector: 'test-north-metrics-component',
  template: ` <oib-north-metrics [connectorMetrics]="metrics" [northConnector]="northConnector" [manifest]="manifest" />`,
  imports: [NorthMetricsComponent]
})
class TestComponent {
  metrics = testData.north.metrics;
  northConnector = testData.north.list[0];
  manifest = testData.north.manifest;
}

class NorthMetricsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }
}

describe('NorthMetricsComponent', () => {
  let tester: NorthMetricsComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new NorthMetricsComponentTester();
  });

  it('should display a title', async () => {
    await tester.change();
    expect(tester.title).toContainText('North 1 metrics');
  });
});
