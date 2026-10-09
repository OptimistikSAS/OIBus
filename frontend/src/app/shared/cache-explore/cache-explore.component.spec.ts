import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CacheContentUpdateCommand, CacheSearchResult, DataFolderType } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { provideCurrentUser } from '../current-user-testing';
import { ObservableState } from '../save-button/save-button.component';
import { CacheExploreComponent } from './cache-explore.component';

@Component({
  template: `<oib-cache-explore
    [entity]="{ id: 'north-1', type: 'north' }"
    [cacheContent]="cacheSearchResult"
    [state]="state"
    (updateCommand)="updateCommands.set([...updateCommands(), $event])"
    (viewCommand)="viewCommands.set([...viewCommands(), $event])"
  />`,
  imports: [CacheExploreComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly cacheSearchResult: CacheSearchResult = {
    searchDate: '2025-01-01T00:00:00.000Z',
    metrics: {
      lastConnection: '2023-01-01T00:00:00.000Z',
      lastRunStart: null,
      lastRunDuration: null,
      currentCacheSize: 100,
      currentErrorSize: 50,
      currentArchiveSize: 200
    },
    cache: [
      {
        filename: 'file-cache-1.json',
        metadata: {
          contentFile: 'data-1.txt',
          contentSize: 100,
          numberOfElement: 1,
          createdAt: '2023-01-01T10:00:00.000Z',
          contentType: 'any'
        }
      }
    ],
    error: [
      {
        filename: 'file-error-1.json',
        metadata: {
          contentFile: 'error-1.txt',
          contentSize: 50,
          numberOfElement: 1,
          createdAt: '2023-01-01T11:00:00.000Z',
          contentType: 'any'
        }
      }
    ],
    archive: []
  };
  readonly state = new ObservableState();
  readonly updateCommands = signal<Array<{ type: 'north' | 'history'; id: string; updateCommand: CacheContentUpdateCommand }>>([]);
  readonly viewCommands = signal<
    Array<{ type: 'north' | 'history'; id: string; fileToRetrieve: { folder: DataFolderType; filename: string } }>
  >([]);
}

class CacheExploreComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly snapshotWarning = this.root.getByCss('.alert-info');
  readonly dirtyWarning = this.root.getByCss('.alert-warning');
  readonly saveButton = this.root.getByRole('button', { name: 'Save changes' });
  readonly cacheContents = this.root.getByCss('oib-cache-content');
  readonly cache = this.root.getByCss('#cache');
  readonly error = this.root.getByCss('#error');
  readonly archive = this.root.getByCss('#archive');
  readonly spinner = this.root.getByCss('.fa-spinner');

  folderTitle(folder: 'cache' | 'error' | 'archive') {
    return this[folder].getByCss('.oib-box-title');
  }
}

describe('CacheExploreComponent', () => {
  let tester: CacheExploreComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser({ ...testData.users.list[0], timezone: 'UTC' })]
    });

    tester = new CacheExploreComponentTester();
  });

  test('should display the snapshot warning and the three folders', async () => {
    await expect
      .element(tester.snapshotWarning)
      .toHaveTextContent(
        'The displayed data is a snapshot from 1 Jan 2025, 00:00:00. The state of the cache may have changed in OIBus since the search.'
      );
    await expect.element(tester.cacheContents).toHaveLength(3);
    await expect.element(tester.folderTitle('cache')).toMatchTextContent(/^Cache folder100 B/);
    await expect.element(tester.folderTitle('error')).toMatchTextContent(/^Error folder50 B/);
    await expect.element(tester.folderTitle('archive')).toMatchTextContent(/^Archive folder200 B/);
    await expect.element(tester.dirtyWarning).not.toBeInTheDocument();
    await expect.element(tester.saveButton).not.toBeInTheDocument();
  });

  test('should emit a view command', async () => {
    await tester.error.getByRole('button', { name: 'View content' }).click();

    expect(tester.host.viewCommands()).toEqual([
      { type: 'north', id: 'north-1', fileToRetrieve: { folder: 'error', filename: 'file-error-1.json' } }
    ]);
    await expect.element(tester.dirtyWarning).not.toBeInTheDocument();
  });

  test('should remove a file locally, recompute the sizes, and save the removal', async () => {
    await tester.cache.getByRole('button', { name: 'Remove content' }).click();

    await expect.element(tester.dirtyWarning).toMatchTextContent(/^You have unsaved changes./);
    await expect.element(tester.cache.getByText('No file in cache folder')).toBeVisible();
    await expect.element(tester.folderTitle('cache')).toMatchTextContent(/^Cache folder0 B/);

    await tester.saveButton.click();

    expect(tester.host.updateCommands()).toEqual([
      {
        type: 'north',
        id: 'north-1',
        updateCommand: {
          cache: { remove: ['file-cache-1.json'], move: [] },
          error: { remove: [], move: [] },
          archive: { remove: [], move: [] }
        }
      }
    ]);
  });

  test('should move files locally, recompute the sizes, and save the moves', async () => {
    await tester.error.getByRole('button', { name: 'Retry content' }).click();
    // the file retried from the error folder is the most recent one of the cache folder
    await tester.cache.getByRole('button', { name: 'Archive content' }).nth(1).click();

    await expect.element(tester.folderTitle('cache')).toMatchTextContent(/^Cache folder50 B/);
    await expect.element(tester.folderTitle('error')).toMatchTextContent(/^Error folder0 B/);
    await expect.element(tester.folderTitle('archive')).toMatchTextContent(/^Archive folder100 B/);

    await tester.saveButton.click();

    expect(tester.host.updateCommands()).toEqual([
      {
        type: 'north',
        id: 'north-1',
        updateCommand: {
          cache: { remove: [], move: [{ filename: 'file-cache-1.json', to: 'archive' }] },
          error: { remove: [], move: [{ filename: 'file-error-1.json', to: 'cache' }] },
          archive: { remove: [], move: [] }
        }
      }
    ]);
  });

  test('should not be dirty when files come back to their original folder', async () => {
    await tester.cache.getByRole('button', { name: 'Error content' }).click();
    await expect.element(tester.dirtyWarning).toBeInTheDocument();

    // the file moved from the cache folder is the oldest one of the error folder
    await tester.error.getByRole('button', { name: 'Retry content' }).nth(1).click();

    await expect.element(tester.dirtyWarning).not.toBeInTheDocument();
  });

  test('should disable the save button while saving', async () => {
    await tester.cache.getByRole('button', { name: 'Remove content' }).click();
    await expect.element(tester.saveButton).toBeEnabled();

    tester.host.state.isPending.next(true);

    await expect.element(tester.saveButton).toBeDisabled();
    await expect.element(tester.spinner).toBeInTheDocument();
  });
});
