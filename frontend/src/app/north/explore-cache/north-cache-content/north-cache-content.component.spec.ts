import { NorthCacheContentComponent } from './north-cache-content.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { Component, viewChild } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

@Component({
  template: `<oib-north-cache-content cacheType="cache" #component [northConnector]="northConnector" />`,
  imports: [NorthCacheContentComponent]
})
class TestComponent {
  readonly component = viewChild.required<NorthCacheContentComponent>('component');
  northConnector: NorthConnectorDTO<NorthSettings> = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO<NorthSettings>;
}

class NorthCacheContentComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get fileCache() {
    return this.elements('td');
  }
}

describe('NorthCacheContent', () => {
  let tester: NorthCacheContentComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new NorthCacheContentComponentTester();
    northConnectorService.searchCacheContent.and.returnValue(of([]));
    northConnectorService.removeCacheContent.and.returnValue(of());
    northConnectorService.moveCacheContent.and.returnValue(of());
    northConnectorService.getCacheFileContent.and.returnValue(of());
    tester.detectChanges();
  });

  it('should have no archive files', () => {
    expect(tester.fileCache.length).toBe(0);
  });

  it('should handle item actions', () => {
    const file = {
      metadataFilename: 'file1.json',
      metadata: {
        contentFile: '8-1696843490050.txt',
        contentSize: 6,
        numberOfElement: 0,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'any',
        source: 'south',
        options: {}
      }
    };

    tester.componentInstance.component().onItemAction({ type: 'remove', file });
    expect(northConnectorService.removeCacheContent).toHaveBeenCalled();

    tester.componentInstance.component().onItemAction({ type: 'archive', file });
    expect(northConnectorService.moveCacheContent).toHaveBeenCalled();

    tester.componentInstance.component().onItemAction({ type: 'view', file });
    expect(northConnectorService.getCacheFileContent).toHaveBeenCalled();
  });
});
