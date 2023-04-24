import { TestBed } from '@angular/core/testing';

import { ComponentTester } from 'ngx-speculoos';
import { SouthDataComponent } from './south-data.component';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';
import { Component } from '@angular/core';
import { SouthConnectorDTO } from '../../../../../../shared/model/south-connector.model';
import { NotificationService } from '../../../shared/notification.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { provideTestingI18n } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-south-data [southConnector]="southConnector"></oib-south-data>`,
  standalone: true,
  imports: [SouthDataComponent]
})
class TestComponent {
  southConnector: SouthConnectorDTO = {
    id: 'southId',
    name: 'South Connector'
  } as SouthConnectorDTO;
}

class SouthDataComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('h2')!;
  }
}

describe('SouthDataComponent', () => {
  let tester: SouthDataComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule, SouthDataComponent],
      providers: [
        provideTestingI18n(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new SouthDataComponentTester();
  });

  it('should set the search form based on the inputs', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('South metrics');
  });
});
