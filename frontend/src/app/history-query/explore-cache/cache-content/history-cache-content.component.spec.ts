import { HistoryCacheContentComponent } from './history-cache-content.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Component, viewChild } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { HistoryQueryDTO } from '../../../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../../../services/history-query.service';

@Component({
  selector: 'oib-test-history-cache-content-component',
  template: ` <oib-history-cache-content cacheType="cache" #component [historyQuery]="historyQuery" />`,
  imports: [HistoryCacheContentComponent]
})
class TestComponent {
  readonly component = viewChild.required<HistoryCacheContentComponent>('component');
  historyQuery: HistoryQueryDTO = {
    id: 'northId',
    name: 'North Connector'
  } as HistoryQueryDTO;
}

class HistoryCacheContentComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get fileCache() {
    return this.elements('td');
  }
}

describe('HistoryCacheContentComponent', () => {
  let tester: HistoryCacheContentComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

  beforeEach(async () => {
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: HistoryQueryService, useValue: historyQueryService }]
    });

    tester = new HistoryCacheContentComponentTester();
    historyQueryService.searchCacheContent.and.returnValue(of([]));
    historyQueryService.removeCacheContent.and.returnValue(of());
    historyQueryService.moveCacheContent.and.returnValue(of());
    historyQueryService.getCacheFileContent.and.returnValue(of());
    await tester.change();
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
    expect(historyQueryService.removeCacheContent).toHaveBeenCalled();

    tester.componentInstance.component().onItemAction({ type: 'archive', file });
    expect(historyQueryService.moveCacheContent).toHaveBeenCalled();

    tester.componentInstance.component().onItemAction({ type: 'view', file });
    expect(historyQueryService.getCacheFileContent).toHaveBeenCalled();
  });
});
