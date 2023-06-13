import { ErrorFilesComponent } from './error-files.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { Component } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-error-files [northConnector]="northConnector"></oib-error-files>`,
  standalone: true,
  imports: [ErrorFilesComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
}

class ErrorFilesComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get fileErrors() {
    return this.elements('td');
  }
}

describe('ErrorFilesComponent', () => {
  let tester: ErrorFilesComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new ErrorFilesComponentTester();
    northConnectorService.getNorthConnectorCacheErrorFiles.and.returnValue(of([]));
    tester.detectChanges();
  });

  it('should have no error files', () => {
    expect(tester.fileErrors.length).toBe(0);
  });
});
