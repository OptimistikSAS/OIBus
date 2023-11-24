import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValueTableComponent } from './value-table.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

describe('ValueTableComponent', () => {
  let component: ValueTableComponent;
  let fixture: ComponentFixture<ValueTableComponent>;
  const testFiles = [
    { filename: '8-1696843490050.txt', valuesCount: 6 },
    { filename: '5-1696843490043.txt', valuesCount: 4 },
    { filename: '4-1696843490042.txt', valuesCount: 5 },
    { filename: '1-1696843490039.txt', valuesCount: 3 },
    { filename: '7-1696843490046.txt', valuesCount: 0 },
    { filename: '6-1696843490045.txt', valuesCount: 0 },
    { filename: '2-1696843490039.txt', valuesCount: 0 },
    { filename: '3-1696843490039.txt', valuesCount: 0 }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValueTableComponent],
      providers: [provideI18nTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(ValueTableComponent);
    component = fixture.componentInstance;
    component.files = [...testFiles];

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be sorted by filename by default', () => {
    expect(component.files[0].filename).toBe('1-1696843490039.txt');
  });

  it('should correctly sort files', () => {
    // Desc filename
    component.toggleColumnSort('filename');
    expect(component.files[0].filename).toBe('8-1696843490050.txt');

    // Interminate filename
    component.toggleColumnSort('filename');
    expect(component.files[0].filename).toBe('8-1696843490050.txt');

    // Asc filename
    component.toggleColumnSort('filename');
    expect(component.files[0].filename).toBe('1-1696843490039.txt');
  });

  it('should correctly sort by values count', () => {
    // Asc values count
    component.toggleColumnSort('valuesCount');
    expect(component.files[0].filename).toBe('2-1696843490039.txt');

    // Desc values count
    component.toggleColumnSort('valuesCount');
    expect(component.files[0].filename).toBe('8-1696843490050.txt');

    // Interminate values count
    component.toggleColumnSort('valuesCount');
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
    expect(component.files[0].filename).toBe('1-1696843490039.txt');

    // Checkboxes are cleared
    const checkedBoxes = [...component.checkboxByFiles.values()];
    expect(checkedBoxes.every(checked => !checked)).toBeTruthy();
  });
});
