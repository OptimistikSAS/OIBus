import { CacheFilesComponent } from './cache-files.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { Component } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-cache-files [northConnector]="northConnector"></oib-cache-files>`,
  standalone: true,
  imports: [CacheFilesComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
}

class CacheFilesComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get fileCache() {
    return this.elements('td');
  }
}

describe('CacheFilesComponent', () => {
  let tester: CacheFilesComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new CacheFilesComponentTester();
    northConnectorService.getCacheFiles.and.returnValue(of([]));
    tester.detectChanges();
  });

  it('should have no archive files', () => {
    expect(tester.fileCache.length).toBe(0);
  });
});
