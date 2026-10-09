import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CacheContentUpdateCommand, CacheSearchResult, FileCacheContent } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../services/history-query.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { ExploreHistoryCacheComponent } from './explore-history-cache.component';

class ExploreHistoryCacheComponentTester {
  readonly fixture = TestBed.createComponent(ExploreHistoryCacheComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('#title');
  readonly filenameContains = this.root.getByLabelText('Filename contains');
  readonly maxNumberOfFiles = this.root.getByLabelText('Maximum number of files');
  readonly searchButton = this.root.getByRole('button', { name: 'Search' });
  readonly cacheExplore = this.root.getByCss('oib-cache-explore');

  /** Emits an output of the cache explorer, as it does when the user views a file or saves the cache modifications */
  emitFromCacheExplore(output: 'viewCommand' | 'updateCommand', value: unknown) {
    this.fixture.debugElement.query(By.directive(CacheExploreComponent)).triggerEventHandler(output, value);
  }
}

const historyQuery = testData.historyQueries.list[0];
const cacheContent: CacheSearchResult = {
  searchDate: '2020-03-15T00:00:00.000Z',
  metrics: {
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    currentCacheSize: 0,
    currentErrorSize: 0,
    currentArchiveSize: 0
  },
  cache: [],
  error: [],
  archive: []
};

describe('ExploreHistoryCacheComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    notificationService = createMock(NotificationService);
    historyQueryService.findById.mockReturnValue(of(historyQuery));
    historyQueryService.searchCacheContent.mockReturnValue(of(cacheContent));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        provideModalTesting(),
        { provide: ActivatedRoute, useValue: stubRoute({ params: { historyQueryId: historyQuery.id } }) },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display the history query and search its cache content', async () => {
    const tester = new ExploreHistoryCacheComponentTester();

    await expect.element(tester.title).toHaveTextContent(`Cache of ${historyQuery.name}`);
    expect(historyQueryService.findById).toHaveBeenCalledWith(historyQuery.id);
    await expect.element(tester.cacheExplore).not.toBeInTheDocument();

    await tester.filenameContains.fill('file');
    await tester.maxNumberOfFiles.fill('50');
    await tester.searchButton.click();

    expect(historyQueryService.searchCacheContent).toHaveBeenCalledWith(historyQuery.id, {
      start: expect.any(String),
      end: expect.any(String),
      nameContains: 'file',
      maxNumberOfFilesReturned: 50
    });
    await expect.element(tester.cacheExplore).toBeInTheDocument();
  });

  test('should not search when the form is invalid', async () => {
    const tester = new ExploreHistoryCacheComponentTester();

    await tester.maxNumberOfFiles.fill('-1');
    await tester.searchButton.click();

    expect(historyQueryService.searchCacheContent).not.toHaveBeenCalled();
  });

  test('should open the content of a cache file', async () => {
    const fileContent: FileCacheContent = {
      content: 'a,b',
      contentFilename: 'file.csv',
      contentType: 'csv',
      truncated: false,
      totalSize: 3
    };
    historyQueryService.getCacheFileContent.mockReturnValue(of(fileContent));
    const fileContentModal = createMock(FileContentModalComponent);
    TestBed.inject(MockModalService).mockClosedModal(fileContentModal);
    const tester = new ExploreHistoryCacheComponentTester();
    await tester.searchButton.click();
    await expect.element(tester.cacheExplore).toBeInTheDocument();

    tester.emitFromCacheExplore('viewCommand', {
      type: 'history',
      id: historyQuery.id,
      fileToRetrieve: { folder: 'error', filename: 'file.csv' }
    });

    expect(historyQueryService.getCacheFileContent).toHaveBeenCalledWith(historyQuery.id, 'error', 'file.csv');
    expect(fileContentModal.prepare).toHaveBeenCalledWith('file.csv', fileContent);
  });

  test('should update the cache content and search it again', async () => {
    historyQueryService.updateCacheContent.mockReturnValue(of(undefined));
    const tester = new ExploreHistoryCacheComponentTester();
    await tester.searchButton.click();
    await expect.element(tester.cacheExplore).toBeInTheDocument();
    const updateCommand: CacheContentUpdateCommand = {
      cache: { remove: ['file1'], move: [] },
      error: { remove: [], move: [{ filename: 'file2', to: 'cache' }] },
      archive: { remove: [], move: [] }
    };

    tester.emitFromCacheExplore('updateCommand', { type: 'history', id: historyQuery.id, updateCommand });

    expect(historyQueryService.updateCacheContent).toHaveBeenCalledWith(historyQuery.id, updateCommand);
    expect(notificationService.success).toHaveBeenCalledWith('explore-cache.cache-updated');
    expect(historyQueryService.searchCacheContent).toHaveBeenCalledTimes(2);
  });
});
