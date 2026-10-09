import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CacheOperation } from '@oibus/shared/api/engine.model';
import { CacheMetadata, DataFolderType } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing';
import { ObservableState } from '../../save-button/save-button.component';
import { CacheContentComponent } from './cache-content.component';

interface CacheFile {
  filename: string;
  metadata: CacheMetadata;
}

@Component({
  selector: 'oib-test-cache-content-component',
  template: `
    <oib-cache-content
      [cacheType]="cacheType()"
      [cacheContentFiles]="files()"
      [size]="size()"
      (operation)="operations.set([...operations(), $event])"
      [state]="state"
    />
  `,
  imports: [CacheContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly cacheType = signal<DataFolderType>('cache');
  readonly files = signal<Array<CacheFile>>([]);
  readonly size = signal(0);
  readonly state = new ObservableState();
  readonly operations = signal<Array<CacheOperation>>([]);
}

class CacheContentComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByCss('.oib-box-title');
  readonly rows = this.root.getByCss('tbody tr');
  readonly filenames = this.root.getByCss('tbody td.filename');
  readonly emptyContainer = this.root.getByCss('.oib-grey-container');
  readonly selectAllButton = this.root.getByRole('button', { name: 'Select all' });
  readonly unselectAllButton = this.root.getByRole('button', { name: 'Unselect all' });
  readonly selectedCounter = this.root.getByCss('.counter-badge');
  readonly removeSelectedButton = this.root.getByRole('button', { name: 'Remove selected content' });
  readonly sortByDate = this.root.getByRole('button', { name: 'Creation date' });
  readonly sortByName = this.root.getByRole('button', { name: 'Filename' });
  readonly sortBySize = this.root.getByRole('button', { name: 'Size' });
  readonly pages = this.root.getByRole('navigation');

  checkbox(filename: string) {
    return this.root.getByRole('checkbox', { name: filename });
  }

  rowAction(rowIndex: number, name: string) {
    return this.rows.nth(rowIndex).getByRole('button', { name });
  }

  async expectFilenames(filenames: Array<string>) {
    await expect.element(this.filenames).toHaveLength(filenames.length);
    expect(this.filenames.elements().map(cell => cell.textContent?.trim())).toEqual(filenames);
  }
}

function cacheFile(index: number, contentFile: string, contentSize: number, createdAt: string): CacheFile {
  return {
    filename: `file-${index}.json`,
    metadata: { contentFile, contentSize, numberOfElement: 1, createdAt, contentType: 'any' }
  };
}

const files: Array<CacheFile> = [
  cacheFile(1, 'b.csv', 300, '2024-01-01T10:00:00.000Z'),
  cacheFile(2, 'c.csv', 100, '2024-01-03T10:00:00.000Z'),
  cacheFile(3, 'a.csv', 200, '2024-01-02T10:00:00.000Z')
];

describe('CacheContentComponent', () => {
  let tester: CacheContentComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });
    tester = new CacheContentComponentTester();
  });

  test.each([
    { cacheType: 'cache' as const, title: 'Cache folder', empty: 'No file in cache folder' },
    { cacheType: 'error' as const, title: 'Error folder', empty: 'No file in error folder' },
    { cacheType: 'archive' as const, title: 'Archive folder', empty: 'No file in archive folder' }
  ])('should display an empty $cacheType folder', async ({ cacheType, title, empty }) => {
    tester.host.cacheType.set(cacheType);

    await expect.element(tester.title).toMatchTextContent(new RegExp(`^${title}0 B`));
    await expect.element(tester.emptyContainer).toHaveTextContent(empty);
    await expect.element(tester.rows).toHaveLength(0);
    await expect.element(tester.removeSelectedButton).not.toBeInTheDocument();
  });

  test('should display the files, the most recent first', async () => {
    tester.host.files.set(files);
    tester.host.size.set(600);

    await expect.element(tester.title).toMatchTextContent(/^Cache folder600 B/);
    await tester.expectFilenames(['c.csv', 'a.csv', 'b.csv']);
    await expect.element(tester.rows.nth(0)).toMatchTextContent(/100 B/);
    await expect.element(tester.pages).not.toBeInTheDocument();
  });

  test('should paginate the files', async () => {
    tester.host.files.set(
      Array.from({ length: 20 }, (_, i) => cacheFile(i, `file-${i}.csv`, i, `2024-01-01T10:${String(i).padStart(2, '0')}:00.000Z`))
    );

    await expect.element(tester.rows).toHaveLength(15);
    await expect.element(tester.filenames.nth(0)).toHaveTextContent('file-19.csv');

    await tester.pages.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.filenames.nth(0)).toHaveTextContent('file-4.csv');
  });

  describe('Sorting', () => {
    beforeEach(() => tester.host.files.set(files));

    test('should sort by date: descending, unsorted, ascending', async () => {
      await tester.expectFilenames(['c.csv', 'a.csv', 'b.csv']);
      await expect.element(tester.sortByDate.getByCss('.fa-sort-down')).toBeInTheDocument();

      await tester.sortByDate.click();
      await tester.expectFilenames(['b.csv', 'c.csv', 'a.csv']);
      await expect.element(tester.sortByDate.getByCss('.fa-sort')).toBeInTheDocument();

      await tester.sortByDate.click();
      await tester.expectFilenames(['b.csv', 'a.csv', 'c.csv']);
      await expect.element(tester.sortByDate.getByCss('.fa-sort-up')).toBeInTheDocument();
    });

    test('should sort by name', async () => {
      await tester.sortByName.click();
      await tester.expectFilenames(['c.csv', 'b.csv', 'a.csv']);

      await tester.sortByName.click();
      await tester.sortByName.click();
      await tester.expectFilenames(['a.csv', 'b.csv', 'c.csv']);
    });

    test('should sort by size', async () => {
      await tester.sortBySize.click();
      await tester.expectFilenames(['b.csv', 'a.csv', 'c.csv']);

      await tester.sortBySize.click();
      await tester.sortBySize.click();
      await tester.expectFilenames(['c.csv', 'a.csv', 'b.csv']);
    });
  });

  describe('Selection', () => {
    beforeEach(() => tester.host.files.set(files));

    test('should select individual files', async () => {
      await expect.element(tester.removeSelectedButton).toBeDisabled();
      await expect.element(tester.unselectAllButton).toBeDisabled();

      await tester.checkbox('a.csv').click();

      await expect.element(tester.checkbox('a.csv')).toBeChecked();
      await expect.element(tester.selectedCounter).toHaveTextContent('1 selected');
      await expect.element(tester.removeSelectedButton).toBeEnabled();

      await tester.checkbox('a.csv').click();
      await expect.element(tester.selectedCounter).not.toBeInTheDocument();
      await expect.element(tester.removeSelectedButton).toBeDisabled();
    });

    test('should select and unselect all files', async () => {
      await tester.selectAllButton.click();

      await expect.element(tester.selectedCounter).toHaveTextContent('3 selected');
      await expect.element(tester.checkbox('b.csv')).toBeChecked();
      await expect.element(tester.selectAllButton).toBeDisabled();

      await tester.unselectAllButton.click();

      await expect.element(tester.selectedCounter).not.toBeInTheDocument();
      await expect.element(tester.checkbox('b.csv')).not.toBeChecked();
    });

    test('should reset the selection when the files change', async () => {
      await tester.selectAllButton.click();
      await expect.element(tester.selectedCounter).toHaveTextContent('3 selected');

      tester.host.files.set(files.slice(1));

      await expect.element(tester.rows).toHaveLength(2);
      await expect.element(tester.selectedCounter).not.toBeInTheDocument();
    });
  });

  test.each([
    { cacheType: 'cache' as const, button: 'Error selected content', operation: { action: 'move', source: 'cache', destination: 'error' } },
    {
      cacheType: 'cache' as const,
      button: 'Archive selected content',
      operation: { action: 'move', source: 'cache', destination: 'archive' }
    },
    { cacheType: 'cache' as const, button: 'Remove selected content', operation: { action: 'remove', folder: 'cache' } },
    { cacheType: 'error' as const, button: 'Retry selected content', operation: { action: 'move', source: 'error', destination: 'cache' } },
    {
      cacheType: 'error' as const,
      button: 'Archive selected content',
      operation: { action: 'move', source: 'error', destination: 'archive' }
    },
    {
      cacheType: 'archive' as const,
      button: 'Replay selected content',
      operation: { action: 'move', source: 'archive', destination: 'cache' }
    },
    { cacheType: 'archive' as const, button: 'Remove selected content', operation: { action: 'remove', folder: 'archive' } }
  ])('should emit the operation of "$button" on the selected files of the $cacheType folder', async ({ cacheType, button, operation }) => {
    tester.host.cacheType.set(cacheType);
    tester.host.files.set(files);
    await tester.checkbox('a.csv').click();
    await tester.checkbox('b.csv').click();

    await tester.root.getByRole('button', { name: button, exact: true }).click();

    expect(tester.host.operations()).toEqual([{ ...operation, filenames: ['file-3.json', 'file-1.json'] }]);
  });

  test.each([
    { cacheType: 'cache' as const, button: 'Error content', operation: { action: 'move', source: 'cache', destination: 'error' } },
    { cacheType: 'cache' as const, button: 'Archive content', operation: { action: 'move', source: 'cache', destination: 'archive' } },
    { cacheType: 'error' as const, button: 'Retry content', operation: { action: 'move', source: 'error', destination: 'cache' } },
    { cacheType: 'error' as const, button: 'Archive content', operation: { action: 'move', source: 'error', destination: 'archive' } },
    { cacheType: 'archive' as const, button: 'Replay content', operation: { action: 'move', source: 'archive', destination: 'cache' } },
    { cacheType: 'archive' as const, button: 'Remove content', operation: { action: 'remove', folder: 'archive' } }
  ])('should emit the operation of "$button" on a file of the $cacheType folder', async ({ cacheType, button, operation }) => {
    tester.host.cacheType.set(cacheType);
    tester.host.files.set(files);

    await tester.rowAction(0, button).click();

    expect(tester.host.operations()).toEqual([{ ...operation, filenames: ['file-2.json'] }]);
  });

  test('should emit a view operation', async () => {
    tester.host.cacheType.set('error');
    tester.host.files.set(files);

    await tester.rowAction(1, 'View content').click();

    expect(tester.host.operations()).toEqual([{ action: 'view', folder: 'error', filename: 'file-3.json' }]);
  });

  test('should disable the file actions while an operation is pending', async () => {
    tester.host.files.set(files);
    await expect.element(tester.rowAction(0, 'Remove content')).toBeEnabled();

    tester.host.state.isPending.next(true);

    await expect.element(tester.rowAction(0, 'Remove content')).toBeDisabled();
    await expect.element(tester.rowAction(0, 'View content')).toBeDisabled();
  });
});
