import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FileTableComponent, FileTableData, ItemActionEvent } from './file-table.component';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { ComponentTester, TestButton } from 'ngx-speculoos';

const firstFile = { filename: '8-1696843490050.txt', modificationDate: '2023-10-10T17:41:59.937Z', size: 6 };
const unsortedFiles: Array<FileTableData> = [
  firstFile,
  { filename: '5-1696843490043.txt', modificationDate: '2023-10-10T17:41:58.395Z', size: 4 },
  { filename: '7-1696843490046.txt', modificationDate: '2023-10-09T09:24:43.208Z', size: 0 },
  { filename: '4-1696843490042.txt', modificationDate: '2023-10-10T17:41:55.343Z', size: 5 },
  { filename: '1-1696843490039.txt', modificationDate: '2023-10-10T17:41:53.331Z', size: 3 },
  { filename: '3-1696843490039.txt', modificationDate: '2023-10-09T09:24:43.187Z', size: 0 },
  { filename: '6-1696843490045.txt', modificationDate: '2023-10-09T09:24:43.207Z', size: 0 },
  { filename: '2-1696843490039.txt', modificationDate: '2023-10-09T09:24:43.187Z', size: 0 }
];

@Component({
  template: `
    <oib-file-table
      [files]="files()"
      [actions]="actions()"
      (itemAction)="onItemAction($event)"
      (selectedFiles)="selectedFiles.set($event)"
    />
  `,
  imports: [FileTableComponent]
})
class FileTableTestComponent {
  readonly files = signal(unsortedFiles);
  readonly actions = signal(['remove', 'retry', 'view', 'archive'] as Array<ItemActionEvent['type']>);
  readonly itemAction = signal<ItemActionEvent | undefined>(undefined);
  readonly selectedFiles = signal<Array<FileTableData>>([]);

  onItemAction(event: ItemActionEvent) {
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
    expect(tester.filenames.length).toBe(8);
  });

  it('should create actions on init', () => {
    expect(tester.actionGroups.length).toBe(8);

    const actionButtons = tester.actionGroups[0].elements('button');
    expect(actionButtons[0].element('span')).toHaveClass('fa-trash');
    expect(actionButtons[1].element('span')).toHaveClass('fa-refresh');
    expect(actionButtons[2].element('span')).toHaveClass('fa-search');
    expect(actionButtons[3].element('span')).toHaveClass('fa-archive');
  });

  it('should dispatch action event', () => {
    tester.removeButton.click();
    expect(tester.componentInstance.itemAction()).toEqual({ type: 'remove', file: firstFile });
  });

  it('should handle passing duplicate actions', () => {
    tester.componentInstance.actions.set(['remove', 'remove', 'remove', 'retry', 'view', 'archive']);
    tester.detectChanges();
    expect(tester.actionGroups.length).toBe(8);

    const actionButtons = tester.actionGroups[0].elements('button');
    expect(actionButtons[0].element('span')).toHaveClass('fa-trash');
    expect(actionButtons[1].element('span')).toHaveClass('fa-refresh');
    expect(actionButtons[2].element('span')).toHaveClass('fa-search');
    expect(actionButtons[3].element('span')).toHaveClass('fa-archive');
  });

  it('should be sorted by modification date by default', () => {
    const modificationDates = tester.modificationDates.map(cell => cell.textContent);
    expect(modificationDates).toEqual([
      '10 Oct 2023, 19:41:59',
      '10 Oct 2023, 19:41:58',
      '10 Oct 2023, 19:41:55',
      '10 Oct 2023, 19:41:53',
      '9 Oct 2023, 11:24:43',
      '9 Oct 2023, 11:24:43',
      '9 Oct 2023, 11:24:43',
      '9 Oct 2023, 11:24:43'
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
    expect(tester.componentInstance.selectedFiles().map(file => file.modificationDate)).toEqual([
      '2023-10-10T17:41:59.937Z',
      '2023-10-10T17:41:58.395Z',
      '2023-10-10T17:41:55.343Z'
    ]);

    tester.checkboxes[0].uncheck();
    expect(tester.componentInstance.selectedFiles().map(file => file.modificationDate)).toEqual([
      '2023-10-10T17:41:58.395Z',
      '2023-10-10T17:41:55.343Z'
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
    expect(tester.filenames.length).toBe(7);

    // Default ordering is kept
    const modificationDates = tester.modificationDates.map(cell => cell.textContent);
    expect(modificationDates).toEqual([
      '10 Oct 2023, 19:41:59',
      '10 Oct 2023, 19:41:58',
      '10 Oct 2023, 19:41:55',
      '10 Oct 2023, 19:41:53',
      '9 Oct 2023, 11:24:43',
      '9 Oct 2023, 11:24:43',
      '9 Oct 2023, 11:24:43'
    ]);

    // Checkboxes are cleared
    expect(tester.componentInstance.selectedFiles()).toEqual([]);
  });
});
