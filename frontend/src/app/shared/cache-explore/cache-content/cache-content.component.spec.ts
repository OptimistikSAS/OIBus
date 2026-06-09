import { CacheContentComponent } from './cache-content.component';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { CacheMetadata, CacheOperation, DataFolderType } from '../../../../../../backend/shared/model/engine.model';
import { ObservableState } from '../../save-button/save-button.component';
import { BehaviorSubject } from 'rxjs';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing-vitest';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-cache-content-component',
  template: `
    <oib-cache-content
      [cacheType]="cacheType()"
      [cacheContentFiles]="files()"
      [size]="size()"
      (operation)="lastOperation.set($event)"
      #component
      [state]="state()"
    />
  `,
  imports: [CacheContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly component = viewChild.required<CacheContentComponent>('component');

  readonly cacheType = signal<DataFolderType>('cache');
  readonly files = signal<Array<{ filename: string; metadata: CacheMetadata }>>([]);
  readonly size = signal(0);
  state = signal<ObservableState>({ isPending: new BehaviorSubject(false), pendingUntilFinalization: () => source => source });

  readonly lastOperation = signal<CacheOperation | undefined>(undefined);
}

class CacheContentComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly tableRows = this.root.getByCss('tbody tr');
  readonly emptyContainer = this.root.getByCss('.oib-grey-container');
  readonly selectAllBtn = this.root.getByCss('#select-all-button');
  readonly unselectAllBtn = this.root.getByCss('#unselect-all-button');
  readonly removeSelectedBtn = this.root.getByCss('#remove-selected-files');
  readonly moveToErrorBtn = this.root.getByCss('#error-selected-content');
  readonly moveToArchiveBtn = this.root.getByCss('#archive-selected-content');
  readonly retrySelectedBtn = this.root.getByCss('#retry-selected-error-content');
  readonly sortDateBtn = this.root.getByCss('.sort-by-modification-date');

  setFiles(files: Array<{ filename: string; metadata: CacheMetadata }>) {
    this.component.files.set(files);
    this.fixture.detectChanges();
  }

  setCacheType(cacheType: DataFolderType) {
    this.component.cacheType.set(cacheType);
    this.fixture.detectChanges();
  }

  checkbox(rowIndex: number) {
    return this.root.getByCss(`tbody tr:nth-child(${rowIndex + 1}) input[type="checkbox"]`);
  }

  rowAction(rowIndex: number, iconClass: string) {
    return this.root.getByCss(`tbody tr:nth-child(${rowIndex + 1}) .action-buttons .fa-${iconClass}`);
  }

  get selectedFileCount() {
    return this.component.component().selectedFileCount();
  }
}

describe('CacheContentComponent', () => {
  let tester: CacheContentComponentTester;

  const sampleFiles = [
    {
      filename: 'file1',
      metadata: {
        contentFile: 'file-A.txt',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2023-01-01T10:00:00.000Z',
        contentType: 'any',
        source: 'south',
        options: {}
      }
    },
    {
      filename: 'file2',
      metadata: {
        contentFile: 'file-B.txt',
        contentSize: 200,
        numberOfElement: 1,
        createdAt: '2023-01-02T10:00:00.000Z',
        contentType: 'any',
        source: 'south',
        options: {}
      }
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });

    tester = new CacheContentComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display empty state message when no files', async () => {
    tester.setFiles([]);

    await expect.element(tester.tableRows).toHaveLength(0);
    await expect.element(tester.emptyContainer).toBeInTheDocument();
  });

  test('should display list of files', async () => {
    tester.setFiles(sampleFiles);

    await expect.element(tester.tableRows).toHaveLength(2);
    await expect.element(tester.tableRows.nth(0)).toHaveTextContent('file-B.txt');
    await expect.element(tester.tableRows.nth(1)).toHaveTextContent('file-A.txt');
  });

  describe('Selection Logic', () => {
    beforeEach(() => {
      tester.setFiles(sampleFiles);
    });

    test('should select individual files', async () => {
      await expect.element(tester.removeSelectedBtn).toBeDisabled();

      await tester.checkbox(0).click();
      tester.fixture.detectChanges();

      expect(tester.selectedFileCount).toBe(1);
      await expect.element(tester.removeSelectedBtn).not.toBeDisabled();
    });

    test('should select all files', async () => {
      await tester.selectAllBtn.click();
      tester.fixture.detectChanges();

      expect(tester.selectedFileCount).toBe(2);
      await expect.element(tester.checkbox(0)).toBeChecked();
      await expect.element(tester.checkbox(1)).toBeChecked();
      await expect.element(tester.selectAllBtn).toBeDisabled();
    });

    test('should unselect all files', async () => {
      await tester.selectAllBtn.click();
      tester.fixture.detectChanges();
      expect(tester.selectedFileCount).toBe(2);

      await tester.unselectAllBtn.click();
      tester.fixture.detectChanges();
      expect(tester.selectedFileCount).toBe(0);
      await expect.element(tester.checkbox(0)).not.toBeChecked();
    });
  });

  describe('Bulk Actions', () => {
    beforeEach(async () => {
      tester.setFiles(sampleFiles);
      await tester.selectAllBtn.click();
      tester.fixture.detectChanges();
    });

    test('should emit remove operation', async () => {
      await tester.removeSelectedBtn.click();

      const op = tester.component.lastOperation();
      expect(op).toEqual({
        action: 'remove',
        folder: 'cache',
        filenames: expect.arrayContaining(['file1', 'file2'])
      });
    });

    test('should emit move to error operation (when type is cache)', async () => {
      await tester.moveToErrorBtn.click();

      const op = tester.component.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'cache',
        destination: 'error',
        filenames: expect.arrayContaining(['file1', 'file2'])
      });
    });

    test('should show different buttons for error folder', async () => {
      tester.setCacheType('error');

      await expect.element(tester.retrySelectedBtn).toBeInTheDocument();
      await expect.element(tester.moveToErrorBtn).not.toBeInTheDocument();

      await tester.retrySelectedBtn.click();

      const op = tester.component.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'error',
        destination: 'cache',
        filenames: expect.arrayContaining(['file1', 'file2'])
      });
    });
  });

  describe('Single Item Actions', () => {
    beforeEach(() => {
      tester.setFiles(sampleFiles);
    });

    test('should emit remove operation for single item', async () => {
      const trashBtn = tester.rowAction(0, 'trash');
      await trashBtn.click();

      const op = tester.component.lastOperation();
      expect(op).toEqual({
        action: 'remove',
        folder: 'cache',
        filenames: ['file2']
      });
    });

    test('should emit archive operation for single item', async () => {
      const archiveBtn = tester.rowAction(0, 'archive');
      await archiveBtn.click();

      const op = tester.component.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'cache',
        destination: 'archive',
        filenames: ['file2']
      });
    });
  });

  describe('Sorting', () => {
    test('should sort by date', async () => {
      tester.setFiles(sampleFiles);

      await expect.element(tester.tableRows.nth(0)).toHaveTextContent('file-B.txt');

      await tester.sortDateBtn.click();
      tester.fixture.detectChanges();
      await expect.element(tester.tableRows.nth(0)).toHaveTextContent('file-A.txt');

      await tester.sortDateBtn.click();
      await tester.sortDateBtn.click();
      tester.fixture.detectChanges();
      await expect.element(tester.tableRows.nth(0)).toHaveTextContent('file-B.txt');
    });
  });
});
