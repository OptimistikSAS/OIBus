import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileTableComponent } from './file-table.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideHttpClient } from '@angular/common/http';

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
      providers: [provideI18nTesting(), provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(FileTableComponent);
    component = fixture.componentInstance;
    component.files = [...testFiles];
    component.actions = ['remove', 'retry', 'view', 'archive'];

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create actions on init', () => {
    const actionGroups = fixture.debugElement.nativeElement.querySelectorAll('.action-buttons');
    expect(actionGroups.length).toBe(8);

    const actionButtons = actionGroups[0].querySelectorAll('button');
    expect(actionButtons[0].querySelector('span').classList).toContain(component.actionButtonData.remove.icon);
    expect(actionButtons[1].querySelector('span').classList).toContain(component.actionButtonData.retry.icon);
    expect(actionButtons[2].querySelector('span').classList).toContain(component.actionButtonData.view.icon);
    expect(actionButtons[3].querySelector('span').classList).toContain(component.actionButtonData.archive.icon);
  });

  it('should dispatch action event', () => {
    spyOn(component.itemAction, 'emit');
    component.onItemActionClick('remove', component.files[0]);
    expect(component.itemAction.emit).toHaveBeenCalledWith({ type: 'remove', file: component.files[0] });
  });

  it('should handle passsing duplicate actions', () => {
    const temp = TestBed.createComponent(FileTableComponent);
    temp.componentInstance.actions = ['remove', 'remove', 'remove', 'retry', 'view', 'archive'];
    temp.detectChanges();
    expect(temp.componentInstance.actions.length).toBe(4);
  });

  it('should be sorted by modification date by deafault', () => {
    const dates = component.files.map(file => new Date(file.modificationDate));
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
    component.onFileCheckboxClick(true, component.files[0]);
    component.onFileCheckboxClick(true, component.files[1]);
    component.onFileCheckboxClick(true, component.files[2]);
    let checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.filter(checked => checked).length).toBe(3);

    component.onFileCheckboxClick(false, component.files[0]);
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
    const dates = component.files.map(file => new Date(file.modificationDate));
    const isDescendingSorted = dates.every((val, i, arr) => !i || val <= arr[i - 1]);
    expect(isDescendingSorted).toBe(true);

    // Checkboxes are cleared
    const checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.every(checked => !checked)).toBeTruthy();
  });
});
