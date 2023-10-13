import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileTableComponent } from './file-table.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

describe('FileTableComponent', () => {
  let component: FileTableComponent;
  let fixture: ComponentFixture<FileTableComponent>;
  const testFiles = [
    { filename: '8-1696843490050.txt', modificationDate: '2023-10-10T17:41:59.937Z', size: 6 },
    { filename: '5-1696843490043.txt', modificationDate: '2023-10-10T17:41:58.395Z', size: 4 },
    { filename: '4-1696843490042.txt', modificationDate: '2023-10-10T17:41:55.343Z', size: 5 },
    { filename: '1-1696843490039.txt', modificationDate: '2023-10-10T17:41:53.331Z', size: 3 },
    { filename: '7-1696843490046.txt', modificationDate: '2023-10-09T09:24:43.208Z', size: 0 },
    { filename: '6-1696843490045.txt', modificationDate: '2023-10-09T09:24:43.207Z', size: 0 },
    { filename: '2-1696843490039.txt', modificationDate: '2023-10-09T09:24:43.187Z', size: 0 },
    { filename: '3-1696843490039.txt', modificationDate: '2023-10-09T09:24:43.187Z', size: 0 }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTableComponent],
      providers: [provideI18nTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(FileTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.files = [...testFiles];
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be sorted by modification date by deafault', () => {
    const dates = testFiles.map(file => new Date(file.modificationDate));
    const isDescendingSorted = dates.every((val, i, arr) => !i || val <= arr[i - 1]);
    expect(isDescendingSorted).toBe(true);
  });

  it('should correctly sort files', () => {
    // Desc filename
    component.toggleColumnSort('filename');
    expect(component.files[0].filename).toBe('1-1696843490039.txt');
    // Asc filename
    component.toggleColumnSort('filename');
    expect(component.files[0].filename).toBe('8-1696843490050.txt');
  });

  it('should correctly check files', () => {
    component.onFileCheckboxClick(true, testFiles[0]);
    component.onFileCheckboxClick(true, testFiles[1]);
    component.onFileCheckboxClick(true, testFiles[2]);
    let checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.filter(checked => checked).length).toBe(3);

    component.onFileCheckboxClick(false, testFiles[0]);
    checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.filter(checked => checked).length).toBe(2);
  });

  it('should correctly check all files', () => {
    component.onFileMainCheckBoxClick(true);
    const checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.every(checked => checked)).toBeTruthy();
  });

  it('should refresh table', () => {
    const newFiles = [...testFiles];
    newFiles.pop();
    component.refreshTable(newFiles);

    // Files changed
    expect(component.files).toEqual(newFiles);

    // Default ordering is kept
    const dates = newFiles.map(file => new Date(file.modificationDate));
    const isDescendingSorted = dates.every((val, i, arr) => !i || val <= arr[i - 1]);
    expect(isDescendingSorted).toBe(true);

    // Checkboxes are cleared
    const checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.every(checked => !checked)).toBeTruthy();
  });
});
