import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FileTableComponent } from './file-table.component';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, TestButton } from 'ngx-speculoos';
import { CacheMetadata } from '../../../../../backend/shared/model/engine.model';
import testData from '../../../../../backend/src/tests/utils/test-data';

const firstFile = {
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
const unsortedFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [
  firstFile,
  {
    metadataFilename: 'file2.json',
    metadata: {
      contentFile: '5-1696843490043.txt',
      contentSize: 4,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_3,
      contentType: 'any',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file3.json',
    metadata: {
      contentFile: '7-1696843490046.txt',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_2,
      contentType: 'any',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file4.json',
    metadata: {
      contentFile: '4-1696843490042.txt',
      contentSize: 5,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_1,
      contentType: 'any',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file5.json',
    metadata: {
      contentFile: '1-1696843490039.txt',
      contentSize: 3,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_1,
      contentType: 'any',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file6.json',
    metadata: {
      contentFile: '3-1696843490039.txt',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_2,
      contentType: 'any',
      source: 'south',
      options: {}
    }
  },
  {
    metadataFilename: 'file7.json',
    metadata: {
      contentFile: '6-1696843490045.txt',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_2,
      contentType: 'any',
      source: 'south',
      options: {}
    }
  }
];

@Component({
  template: `
    <oib-file-table
      [files]="files()"
      cacheType="archive"
      [isActionRunning]="isActionRunning()"
      (itemAction)="onItemAction($event)"
      (selectedFiles)="selectedFiles.set($event)"
    />
  `,
  imports: [FileTableComponent]
})
class FileTableTestComponent {
  readonly files = signal(unsortedFiles);
  readonly isActionRunning = signal(false);
  readonly itemAction = signal<
    | {
        type: 'remove' | 'error' | 'archive' | 'retry' | 'view';
        file: { metadataFilename: string; metadata: CacheMetadata };
      }
    | undefined
  >(undefined);
  readonly selectedFiles = signal<Array<{ metadataFilename: string; metadata: CacheMetadata }>>([]);

  onItemAction(event: {
    type: 'remove' | 'error' | 'archive' | 'retry' | 'view';
    file: { metadataFilename: string; metadata: CacheMetadata };
  }) {
    this.itemAction.set(event);
  }
}

class FileTestComponentTester extends ComponentTester<FileTableTestComponent> {
  constructor() {
    super(FileTableTestComponent);
  }

  get filenames() {
    return this.elements('.filename');
  }

  get modificationDates() {
    return this.elements('.modification-date');
  }

  get actionGroups() {
    return this.elements('.action-buttons');
  }

  get removeButton() {
    return this.element('.fa-trash')! as TestButton;
  }

  get sortByFilenameButton() {
    return this.button('.sort-by-filename')!;
  }

  get checkboxes() {
    return this.elements<HTMLInputElement>('tbody .form-check-input');
  }

  get selectAllButton() {
    return this.button('#select-all-button')!;
  }

  get unselectAllButton() {
    return this.button('#unselect-all-button')!;
  }
}

describe('FileTableComponent', () => {
  let tester: FileTestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideHttpClient()]
    });

    tester = new FileTestComponentTester();
    tester.detectChanges();
  });

  it('should display files', () => {
    expect(tester.filenames.length).toBe(7);
  });

  it('should dispatch action event', () => {
    tester.removeButton.click();
    expect(tester.componentInstance.itemAction()).toEqual({ type: 'remove', file: unsortedFiles[1] });
  });

  it('should be sorted by modification date by default', () => {
    const modificationDates = tester.modificationDates.map(cell => cell.textContent);
    expect(modificationDates).toEqual([
      '25 Mar 2020, 01:00:00',
      '20 Mar 2020, 01:00:00',
      '20 Mar 2020, 01:00:00',
      '20 Mar 2020, 01:00:00',
      '15 Mar 2020, 01:00:00',
      '15 Mar 2020, 01:00:00',
      '15 Mar 2020, 01:00:00'
    ]);
  });

  it('should correctly sort files', () => {
    tester.sortByFilenameButton.click();
    tester.detectChanges();
    expect(tester.filenames[0]).toHaveText('8-1696843490050.txt');
    expect(tester.sortByFilenameButton.element('span.fa')).toHaveClass('fa-sort-desc');

    tester.sortByFilenameButton.click();
    expect(tester.filenames[0]).toHaveText('8-1696843490050.txt');
    expect(tester.sortByFilenameButton.element('span.fa')).toHaveClass('fa-sort');

    tester.sortByFilenameButton.click();
    expect(tester.filenames[0]).toHaveText('1-1696843490039.txt');
    expect(tester.sortByFilenameButton.element('span.fa')).toHaveClass('fa-sort-asc');
  });

  it('should correctly check files', () => {
    expect(tester.checkboxes.length).toBe(7);

    tester.checkboxes[0].check();
    tester.detectChanges();
    expect(tester.componentInstance.selectedFiles().length).toBe(1);

    tester.checkboxes[1].check();
    tester.detectChanges();
    expect(tester.componentInstance.selectedFiles().length).toBe(2);

    tester.checkboxes[2].check();
    tester.detectChanges();
    expect(tester.componentInstance.selectedFiles().length).toBe(3);

    tester.checkboxes[0].uncheck();
    tester.detectChanges();
    expect(tester.componentInstance.selectedFiles().length).toBe(2);
  });

  it('should correctly check all files', () => {
    tester.selectAllButton.click();
    expect(tester.componentInstance.selectedFiles()).toEqual(unsortedFiles);
    tester.unselectAllButton.click();
    expect(tester.componentInstance.selectedFiles()).toEqual([]);
  });

  it('should refresh table', () => {
    const newFiles = [...unsortedFiles];
    newFiles.pop();

    tester.componentInstance.files.set(newFiles);
    tester.detectChanges();

    // Files changed
    expect(tester.filenames.length).toBe(6);

    // Default ordering is kept
    const modificationDates = tester.modificationDates.map(cell => cell.textContent);
    expect(modificationDates).toEqual([
      '25 Mar 2020, 01:00:00',
      '20 Mar 2020, 01:00:00',
      '20 Mar 2020, 01:00:00',
      '15 Mar 2020, 01:00:00',
      '15 Mar 2020, 01:00:00',
      '15 Mar 2020, 01:00:00'
    ]);

    // Checkboxes are cleared
    expect(tester.componentInstance.selectedFiles()).toEqual([]);
  });
});
