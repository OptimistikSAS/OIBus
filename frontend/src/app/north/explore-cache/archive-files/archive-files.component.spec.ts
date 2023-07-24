import { ArchiveFilesComponent } from './archive-files.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { Component } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-archive-files [northConnector]="northConnector"></oib-archive-files>`,
  standalone: true,
  imports: [ArchiveFilesComponent]
})
class TestComponent {
  northConnector: NorthConnectorDTO = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO;
}

class ArchiveFilesComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get fileArchives() {
    return this.elements('td');
  }
}

describe('ArchiveFilesComponent', () => {
  let tester: ArchiveFilesComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new ArchiveFilesComponentTester();
    northConnectorService.getNorthConnectorCacheArchiveFiles.and.returnValue(of([]));
    tester.detectChanges();
  });

  it('should have no archive files', () => {
    expect(tester.fileArchives.length).toBe(0);
  });
});
