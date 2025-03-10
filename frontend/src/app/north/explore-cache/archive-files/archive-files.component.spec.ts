import { ArchiveFilesComponent } from './archive-files.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { Component, viewChild } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  template: `<oib-archive-files #component [northConnector]="northConnector" />`,
  imports: [ArchiveFilesComponent]
})
class TestComponent {
  readonly component = viewChild.required<ArchiveFilesComponent>('component');
  northConnector: NorthConnectorDTO<NorthSettings> = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO<NorthSettings>;
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
    northConnectorService.getCacheArchiveFiles.and.returnValue(of([]));
    northConnectorService.removeCacheArchiveFiles.and.returnValue(of());
    northConnectorService.retryCacheArchiveFiles.and.returnValue(of());
    northConnectorService.getCacheArchiveFileContent.and.returnValue(of());
    tester.detectChanges();
  });

  it('should have no archive files', () => {
    expect(tester.fileArchives.length).toBe(0);
  });

  it('should handle item actions', () => {
    const file = {
      filename: 'filename',
      modificationDate: '2021-01-01T00:00:00.000Z',
      size: 123
    };

    tester.componentInstance.component().onItemAction({ type: 'remove', file });
    expect(northConnectorService.removeCacheArchiveFiles).toHaveBeenCalled();

    tester.componentInstance.component().onItemAction({ type: 'retry', file });
    expect(northConnectorService.retryCacheArchiveFiles).toHaveBeenCalled();

    tester.componentInstance.component().onItemAction({ type: 'view', file });
    expect(northConnectorService.getCacheArchiveFileContent).toHaveBeenCalled();
  });
});
