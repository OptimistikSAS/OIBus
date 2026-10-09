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
import { NorthConnectorService } from '../../services/north-connector.service';
import { FileContentModalComponent } from '../../shared/cache-explore/cache-content/file-content-modal/file-content-modal.component';
import { CacheExploreComponent } from '../../shared/cache-explore/cache-explore.component';
import { provideCurrentUser } from '../../shared/current-user-testing';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { ExploreNorthCacheComponent } from './explore-north-cache.component';

class ExploreNorthCacheComponentTester {
  readonly fixture = TestBed.createComponent(ExploreNorthCacheComponent);
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

const northConnector = testData.north.list[0];
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

describe('ExploreNorthCacheComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);
    northConnectorService.findById.mockReturnValue(of(northConnector));
    northConnectorService.searchCacheContent.mockReturnValue(of(cacheContent));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        provideModalTesting(),
        { provide: ActivatedRoute, useValue: stubRoute({ params: { northId: northConnector.id } }) },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
  });

  test('should display the north connector and search its cache content', async () => {
    const tester = new ExploreNorthCacheComponentTester();

    await expect.element(tester.title).toHaveTextContent(`Cache of ${northConnector.name}`);
    expect(northConnectorService.findById).toHaveBeenCalledWith(northConnector.id);
    await expect.element(tester.cacheExplore).not.toBeInTheDocument();

    await tester.filenameContains.fill('file');
    await tester.maxNumberOfFiles.fill('50');
    await tester.searchButton.click();

    expect(northConnectorService.searchCacheContent).toHaveBeenCalledWith(northConnector.id, {
      start: expect.any(String),
      end: expect.any(String),
      nameContains: 'file',
      maxNumberOfFilesReturned: 50
    });
    await expect.element(tester.cacheExplore).toBeInTheDocument();
  });

  test('should not search when the form is invalid', async () => {
    const tester = new ExploreNorthCacheComponentTester();

    await tester.maxNumberOfFiles.fill('-1');
    await tester.searchButton.click();

    expect(northConnectorService.searchCacheContent).not.toHaveBeenCalled();
  });

  test('should open the content of a cache file', async () => {
    const fileContent: FileCacheContent = {
      content: 'a,b',
      contentFilename: 'file.csv',
      contentType: 'csv',
      truncated: false,
      totalSize: 3
    };
    northConnectorService.getCacheFileContent.mockReturnValue(of(fileContent));
    const fileContentModal = createMock(FileContentModalComponent);
    TestBed.inject(MockModalService).mockClosedModal(fileContentModal);
    const tester = new ExploreNorthCacheComponentTester();
    await tester.searchButton.click();
    await expect.element(tester.cacheExplore).toBeInTheDocument();

    tester.emitFromCacheExplore('viewCommand', {
      type: 'north',
      id: northConnector.id,
      fileToRetrieve: { folder: 'error', filename: 'file.csv' }
    });

    expect(northConnectorService.getCacheFileContent).toHaveBeenCalledWith(northConnector.id, 'error', 'file.csv');
    expect(fileContentModal.prepare).toHaveBeenCalledWith('file.csv', fileContent);
  });

  test('should update the cache content and search it again', async () => {
    northConnectorService.updateCacheContent.mockReturnValue(of(undefined));
    const tester = new ExploreNorthCacheComponentTester();
    await tester.searchButton.click();
    await expect.element(tester.cacheExplore).toBeInTheDocument();
    const updateCommand: CacheContentUpdateCommand = {
      cache: { remove: ['file1'], move: [] },
      error: { remove: [], move: [{ filename: 'file2', to: 'cache' }] },
      archive: { remove: [], move: [] }
    };

    tester.emitFromCacheExplore('updateCommand', { type: 'north', id: northConnector.id, updateCommand });

    expect(northConnectorService.updateCacheContent).toHaveBeenCalledWith(northConnector.id, updateCommand);
    expect(notificationService.success).toHaveBeenCalledWith('explore-cache.cache-updated');
    expect(northConnectorService.searchCacheContent).toHaveBeenCalledTimes(2);
  });
});
