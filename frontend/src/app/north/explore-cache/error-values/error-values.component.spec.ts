import { ErrorValuesComponent } from './error-values.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { Component } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { NorthItemSettings, NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  template: `<oib-error-values [northConnector]="northConnector" />`,
  imports: [ErrorValuesComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO<NorthSettings, NorthItemSettings> = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO<NorthSettings, NorthItemSettings>;
}

class ErrorValuesComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get errorValues() {
    return this.elements('td');
  }
}

describe('ErrorValuesComponent', () => {
  let tester: ErrorValuesComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new ErrorValuesComponentTester();
    northConnectorService.getCacheErrorValues.and.returnValue(of([]));
    tester.detectChanges();
  });

  it('should have no error files', () => {
    expect(tester.errorValues.length).toBe(0);
  });
});
