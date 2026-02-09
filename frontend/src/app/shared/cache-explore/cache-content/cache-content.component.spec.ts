import { CacheContentComponent } from './cache-content.component';
import { ComponentTester } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { CacheMetadata, CacheOperation, DataFolderType } from '../../../../../../backend/shared/model/engine.model';
import { ObservableState } from '../../save-button/save-button.component';
import { BehaviorSubject } from 'rxjs';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing';

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

  // Signals for inputs
  readonly cacheType = signal<DataFolderType>('cache');
  readonly files = signal<Array<{ filename: string; metadata: CacheMetadata }>>([]);
  readonly size = signal(0);
  state = signal<ObservableState>({ isPending: new BehaviorSubject(false), pendingUntilFinalization: () => source => source });

  // Signal to capture the output
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
    return this.button('#error-selected-content')!; // Only visible in 'cache' type
  }

  get moveToArchiveBtn() {
    return this.button('#archive-selected-content')!; // Only visible in 'cache' type
  }

  get retrySelectedBtn() {
    return this.button('#retry-selected-error-content')!; // Only visible in 'error' type
  }

  // Helper to get checkboxes for specific rows
  checkbox(rowIndex: number) {
    return this.input(`tbody tr:nth-child(${rowIndex + 1}) input[type="checkbox"]`)!;
  }

  // Helper to get action buttons for specific rows
  rowAction(rowIndex: number, iconClass: string) {
    // Finds the button containing the specific fa-icon class
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
        createdAt: '2023-01-02T10:00:00.000Z', // Newer
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

  it('should display empty state message when no files', () => {
    tester.componentInstance.files.set([]);
    tester.detectChanges();

    expect(tester.tableRows.length).toBe(0);
    // Expect the grey container with "No file..." message
    expect(tester.element('.oib-grey-container')).not.toBeNull();
  });

  it('should display list of files', async () => {
    tester.componentInstance.files.set(sampleFiles);
    await tester.change();

    expect(tester.tableRows.length).toBe(2);
    // Default sort is Descending Date (Newest first) -> File B (Jan 2), File A (Jan 1)
    expect(tester.tableRows[0].textContent).toContain('file-B.txt');
    expect(tester.tableRows[1].textContent).toContain('file-A.txt');
  });

  describe('Selection Logic', () => {
    beforeEach(async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();
    });

    it('should select individual files', async () => {
      // Buttons exist but are disabled initially
      expect(tester.removeSelectedBtn.disabled).toBeTrue();

      await tester.checkbox(0).check(); // Select first row

      expect(tester.componentInstance.component().selectedFileCount()).toBe(1);
      expect(tester.removeSelectedBtn.disabled).toBeFalse();
    });

    it('should select all files', async () => {
      await tester.selectAllBtn.click();

      expect(tester.componentInstance.component().selectedFileCount()).toBe(2);
      expect(tester.checkbox(0).checked).toBeTrue();
      expect(tester.checkbox(1).checked).toBeTrue();
      expect(tester.selectAllBtn.disabled).toBeTrue(); // Should be disabled if all selected
    });

    it('should unselect all files', async () => {
      await tester.selectAllBtn.click();
      expect(tester.componentInstance.component().selectedFileCount()).toBe(2);

      await tester.unselectAllBtn.click();
      expect(tester.componentInstance.component().selectedFileCount()).toBe(0);
      expect(tester.checkbox(0).checked).toBeFalse();
    });
  });

  describe('Bulk Actions', () => {
    beforeEach(async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();
      await tester.selectAllBtn.click(); // Select all to enable buttons
    });

    it('should emit remove operation', async () => {
      await tester.removeSelectedBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'remove',
        folder: 'cache',
        filenames: jasmine.arrayContaining(['file1', 'file2'])
      });
    });

    it('should emit move to error operation (when type is cache)', async () => {
      // Input cacheType is 'cache' by default
      await tester.moveToErrorBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'cache',
        destination: 'error',
        filenames: jasmine.arrayContaining(['file1', 'file2'])
      });
    });

    it('should show different buttons for error folder', async () => {
      tester.componentInstance.cacheType.set('error');
      await tester.change();
      await tester.selectAllBtn.click(); // Re-select because changing inputs might reset selection

      // Buttons specific to error type should be visible
      expect(tester.retrySelectedBtn).not.toBeNull();
      expect(tester.moveToErrorBtn).toBeNull(); // Should not see "move to error" when in error folder

      await tester.retrySelectedBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'move',
        source: 'error',
        destination: 'cache', // Retry moves back to cache
        filenames: jasmine.arrayContaining(['file1', 'file2'])
      });
    });
  });

  describe('Single Item Actions', () => {
    beforeEach(async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();
    });

    it('should emit remove operation for single item', async () => {
      // Find the trash icon on the first row (file-B because of sort)
      const trashBtn = tester.rowAction(0, 'trash');
      await trashBtn.click();

      const op = tester.componentInstance.lastOperation();
      expect(op).toEqual({
        action: 'remove',
        folder: 'cache',
        filenames: ['file2']
      });
    });

    it('should emit archive operation for single item', async () => {
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
    it('should sort by date', async () => {
      tester.componentInstance.files.set(sampleFiles);
      await tester.change();

      // Initial: Descending (Newest first) -> File B, File A
      expect(tester.tableRows[0].textContent).toContain('file-B.txt');

      // Click Sort -> Ascending (Oldest first) -> File A, File B
      await tester.sortDateBtn.click();
      expect(tester.tableRows[0].textContent).toContain('file-A.txt');

      // Click Sort again -> Descending -> File B, File A
      await tester.sortDateBtn.click();
      await tester.sortDateBtn.click();
      expect(tester.tableRows[0].textContent).toContain('file-B.txt');
    });
  });
});
