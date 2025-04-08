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
    contentType: 'raw',
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
      contentType: 'raw',
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
      contentType: 'raw',
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
      contentType: 'raw',
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
      contentType: 'raw',
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
      contentType: 'raw',
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
      contentType: 'raw',
      source: 'south',
      options: {}
    }
  }
];

@Component({
  template: `
    <oib-file-table [files]="files()" cacheType="archive" (itemAction)="onItemAction($event)" (selectedFiles)="selectedFiles.set($event)" />
  `,
  imports: [FileTableComponent]
})
class FileTableTestComponent {
  readonly files = signal(unsortedFiles);
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
    return this.elements<HTMLInputElement>('.toggle-parameter');
  }

  get mainCheckbox() {
    return this.element<HTMLInputElement>('#toggle-all-parameters')!;
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
    tester.checkboxes[0].check();
    tester.checkboxes[1].check();
    tester.checkboxes[2].check();
    // the first 3 sorted files are checked
    expect(tester.componentInstance.selectedFiles().map(file => file.metadata.createdAt)).toEqual([
      '2020-03-25T00:00:00.000Z',
      '2020-03-20T00:00:00.000Z',
      '2020-03-20T00:00:00.000Z'
    ]);

    tester.checkboxes[0].uncheck();
    expect(tester.componentInstance.selectedFiles().map(file => file.metadata.createdAt)).toEqual([
      '2020-03-20T00:00:00.000Z',
      '2020-03-20T00:00:00.000Z'
    ]);
  });

  it('should correctly check all files', () => {
    tester.mainCheckbox.check();
    expect(tester.componentInstance.selectedFiles()).toEqual(unsortedFiles);
    tester.mainCheckbox.uncheck();
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
