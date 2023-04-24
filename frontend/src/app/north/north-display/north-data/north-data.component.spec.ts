import { TestBed } from '@angular/core/testing';

import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthDataComponent } from './north-data.component';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NotificationService } from '../../../shared/notification.service';
import { provideTestingI18n } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-north-data [northConnector]="northConnector"></oib-north-data>`,
  standalone: true,
  imports: [NorthDataComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
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
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      imports: [MockI18nModule, NorthDataComponent],
      providers: [
        provideTestingI18n(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    tester = new SouthDataComponentTester();
  });

  it('should set the search form based on the inputs', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('North metrics');
  });
});
