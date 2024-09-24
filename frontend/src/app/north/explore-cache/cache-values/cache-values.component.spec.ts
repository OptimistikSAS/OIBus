import { CacheValuesComponent } from './cache-values.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { Component } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-cache-values [northConnector]="northConnector" />`,
  standalone: true,
  imports: [CacheValuesComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
}

class CacheValuesComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get cacheValues() {
    return this.elements('td');
  }
}

describe('CacheValuesComponent', () => {
  let tester: CacheValuesComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new CacheValuesComponentTester();
    northConnectorService.getCacheValues.and.returnValue(of([]));
    tester.detectChanges();
  });

  it('should have no cache values', () => {
    expect(tester.cacheValues.length).toBe(0);
  });
});
