import { TestBed } from '@angular/core/testing';

import { ComponentTester } from 'ngx-speculoos';
import { NorthDataComponent } from './north-data.component';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';
import { Component } from '@angular/core';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';

@Component({
  template: `<oib-north-data [northConnector]="northConnector"></oib-north-data>`,
  standalone: true,
  imports: [NorthDataComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'southId',
    name: 'South Connector'
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule, NorthDataComponent],
      providers: []
    });

    tester = new SouthDataComponentTester();
  });

  it('should set the search form based on the inputs', () => {
    tester.detectChanges();

    expect(tester.title).toContainText('North metrics');
  });
});
