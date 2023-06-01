import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthMetricsComponent } from './north-metrics.component';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NotificationService } from '../../../shared/notification.service';
import { provideTestingI18n } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-north-metrics [northConnector]="northConnector"></oib-north-metrics>`,
  standalone: true,
  imports: [NorthMetricsComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
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

  beforeEach(async () => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      imports: [MockI18nModule, NorthMetricsComponent],
      providers: [
        provideTestingI18n(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new NorthMetricsComponentTester();
  });

  it('should display a title', () => {
    tester.detectChanges();
    expect(tester.title).toContainText('Monitoring');
  });
});
