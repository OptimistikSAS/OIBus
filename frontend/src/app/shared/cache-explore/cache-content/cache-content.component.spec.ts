import { CacheContentComponent } from './cache-content.component';
import { ComponentTester } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { CacheMetadata, CacheOperation, DataFolderType } from '../../../../../../backend/shared/model/engine.model';
import { ObservableState } from '../../save-button/save-button.component';
import { BehaviorSubject } from 'rxjs';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing-vitest';
import { beforeEach, describe, expect, test } from 'vitest';

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
  imports: [CacheContentComponent]
})
class TestComponent {
  readonly component = viewChild.required<CacheContentComponent>('component');

  readonly cacheType = signal<DataFolderType>('cache');
  readonly files = signal<Array<{ filename: string; metadata: CacheMetadata }>>([]);
  readonly size = signal(0);
  state = signal<ObservableState>({ isPending: new BehaviorSubject(false), pendingUntilFinalization: () => source => source });

  readonly lastOperation = signal<CacheOperation | undefined>(undefined);
}

class CacheContentComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get tableRows() {
    return this.elements('tbody tr')!;
  }

  get selectAllBtn() {
    return this.button('#select-all-button')!;
  }

  get unselectAllBtn() {
    return this.button('#unselect-all-button')!;
  }

  get removeSelectedBtn() {
    return this.button('#remove-selected-files')!;
  }

  get moveToErrorBtn() {
    return this.button('#error-selected-content')!;
  }

  get moveToArchiveBtn() {
    return this.button('#archive-selected-content')!;
  }

  get retrySelectedBtn() {
    return this.button('#retry-selected-error-content')!;
  }

  checkbox(rowIndex: number) {
    return this.input(`tbody tr:nth-child(${rowIndex + 1}) input[type="checkbox"]`)!;
  }

  rowAction(rowIndex: number, iconClass: string) {
    return this.element(`tbody tr:nth-child(${rowIndex + 1}) .action-buttons .fa-${iconClass}`)!.nativeElement
      .parentElement as HTMLButtonElement;
  }

  get sortDateBtn() {
    return this.button('.sort-by-modification-date')!;
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });

    tester = new CacheContentComponentTester();
    await tester.change();
  });

  test('should display empty state message when no files', async () => {
    tester.componentInstance.files.set([]);
    await tester.change();

    expect(tester.tableRows.length).toBe(0);
    expect(tester.element('.oib-grey-container')).not.toBeNull();
  });

  test('should display list of files', async () => {
    tester.componentInstance.files.set(sampleFiles);
    await tester.change();

    expect(tester.tableRows.length).toBe(2);
    expect(tester.tableRows[0].textContent).toContain('file-B.txt');
    expect(tester.tableRows[1].textContent).toContain('file-A.txt');
  });

  describe('Selection Logic', () => {
    beforeEach(async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();
    });

    test('should select individual files', async () => {
      expect(tester.removeSelectedBtn.disabled).toBe(true);

      await tester.checkbox(0).check();

      expect(tester.componentInstance.component().selectedFileCount()).toBe(1);
      expect(tester.removeSelectedBtn.disabled).toBe(false);
    });

    test('should select all files', async () => {
      await tester.selectAllBtn.click();

      expect(tester.componentInstance.component().selectedFileCount()).toBe(2);
      expect(tester.checkbox(0).checked).toBe(true);
      expect(tester.checkbox(1).checked).toBe(true);
      expect(tester.selectAllBtn.disabled).toBe(true);
    });

    test('should unselect all files', async () => {
      await tester.selectAllBtn.click();
      expect(tester.componentInstance.component().selectedFileCount()).toBe(2);

      await tester.unselectAllBtn.click();
      expect(tester.componentInstance.component().selectedFileCount()).toBe(0);
      expect(tester.checkbox(0).checked).toBe(false);
    });
  });

  describe('Bulk Actions', () => {
    beforeEach(async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();
      await tester.selectAllBtn.click();
    });

    test('should emit remove operation', async () => {
      await tester.removeSelectedBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'remove',
        folder: 'cache',
        filenames: expect.arrayContaining(['file1', 'file2'])
      });
    });

    test('should emit move to error operation (when type is cache)', async () => {
      await tester.moveToErrorBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'cache',
        destination: 'error',
        filenames: expect.arrayContaining(['file1', 'file2'])
      });
    });

    test('should show different buttons for error folder', async () => {
      tester.componentInstance.cacheType.set('error');
      await tester.change();
      await tester.selectAllBtn.click();

      expect(tester.retrySelectedBtn).not.toBeNull();
      expect(tester.moveToErrorBtn).toBeNull();

      await tester.retrySelectedBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'error',
        destination: 'cache',
        filenames: expect.arrayContaining(['file1', 'file2'])
      });
    });
  });

  describe('Single Item Actions', () => {
    beforeEach(async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();
    });

    test('should emit remove operation for single item', async () => {
      const trashBtn = tester.rowAction(0, 'trash');
      await trashBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'remove',
        folder: 'cache',
        filenames: ['file2']
      });
    });

    test('should emit archive operation for single item', async () => {
      const archiveBtn = tester.rowAction(0, 'archive');
      await archiveBtn.click();

      const op = tester.componentInstance.lastOperation();
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
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();

      expect(tester.tableRows[0].textContent).toContain('file-B.txt');

      await tester.sortDateBtn.click();
      expect(tester.tableRows[0].textContent).toContain('file-A.txt');

      await tester.sortDateBtn.click();
      await tester.sortDateBtn.click();
      expect(tester.tableRows[0].textContent).toContain('file-B.txt');
    });
  });
});
