import { CacheFilesComponent } from './cache-files.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { Component, ViewChild } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-cache-files #component [northConnector]="northConnector" />`,
  standalone: true,
  imports: [CacheFilesComponent]
})
class TestComponent {
  @ViewChild('component') component!: CacheFilesComponent;
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
    northConnectorService.removeCacheFiles.and.returnValue(of());
    northConnectorService.archiveCacheFiles.and.returnValue(of());
    northConnectorService.getCacheFileContent.and.returnValue(of());
    tester.detectChanges();
  });

  it('should have no archive files', () => {
    expect(tester.fileCache.length).toBe(0);
  });

  it('should handle item actions', () => {
    const file = {
      filename: 'filename',
      modificationDate: '2021-01-01T00:00:00.000Z',
      size: 123
    };

    tester.componentInstance.component.onItemAction({ type: 'remove', file });
    expect(northConnectorService.removeCacheFiles).toHaveBeenCalled();

    tester.componentInstance.component.onItemAction({ type: 'archive', file });
    expect(northConnectorService.archiveCacheFiles).toHaveBeenCalled();

    tester.componentInstance.component.onItemAction({ type: 'view', file });
    expect(northConnectorService.getCacheFileContent).toHaveBeenCalled();
  });
});
