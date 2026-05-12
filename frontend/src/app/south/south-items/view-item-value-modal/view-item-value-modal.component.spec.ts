import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { ViewItemValueModalComponent } from './view-item-value-modal.component';

class ViewItemValueModalComponentTester extends ComponentTester<ViewItemValueModalComponent> {
  constructor() {
    super(ViewItemValueModalComponent);
  }

  get closeButton() {
    return this.button('.btn-close')!;
  }

  get footerCloseButton() {
    return this.button('.btn-secondary')!;
  }

  get modalBody() {
    return this.element('.modal-body')!;
  }

  get spinner() {
    return this.element('.spinner-border');
  }

  get errorAlert() {
    return this.element('.alert-danger');
  }

  get infoAlert() {
    return this.element('.alert-info');
  }
}

describe('ViewItemValueModalComponent', () => {
  let tester: ViewItemValueModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  const itemLastValueWithValue = {
    itemId: 'item-1',
    itemName: 'My Item',
    queryTime: '2025-02-03T10:00:00.000Z',
    value: { foo: 'bar', count: 42 },
    trackedInstant: '2025-02-03T10:05:00.000Z'
  };

  const itemLastValueWithFileArray = {
    itemId: 'item-2',
    itemName: 'File Scanner Item',
    queryTime: '2025-02-03T10:00:00.000Z',
    value: [
      { filename: 'file1.txt', modifiedTime: 1706950800000 },
      { filename: 'file2.csv', modifiedTime: 1706950900000 }
    ],
    trackedInstant: '2025-02-03T10:05:00.000Z'
  };

  const itemLastValueNoValue = {
    itemId: 'item-3',
    itemName: 'Empty Item',
    queryTime: null,
    value: null,
    trackedInstant: null
  };

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ViewItemValueModalComponentTester();
    await tester.change();
  });

  // --- Loading state ---

  it('should show a spinner before data arrives', async () => {
    tester.componentInstance.prepare('opcua');
    await tester.change();

    expect(tester.spinner).not.toBeNull();
    expect(tester.element('.container-fluid')).toBeNull();
  });

  it('should hide the spinner once data arrives', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    expect(tester.spinner).toBeNull();
    expect(tester.element('.container-fluid')).not.toBeNull();
  });

  // --- Error state ---

  it('should show an error alert when setError is called', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setError('Connection refused');
    await tester.change();

    expect(tester.spinner).toBeNull();
    expect(tester.errorAlert).not.toBeNull();
    expect(tester.errorAlert!.textContent).toContain('Connection refused');
  });

  it('should not show content when in error state', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setError('Timeout');
    await tester.change();

    expect(tester.element('.container-fluid')).toBeNull();
  });

  // --- Dismiss ---

  it('should dismiss when close button in header is clicked', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    tester.closeButton.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should dismiss when footer close button is clicked', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    tester.footerCloseButton.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  // --- Content rendering ---

  it('should display item name and value when data is set', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    expect(tester.modalBody.textContent).toContain('My Item');
    expect(tester.modalBody.textContent).toContain('42');
  });

  it('should have hasValue true when value is set', () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    expect(tester.componentInstance.hasValue).toBe(true);
  });

  it('should have hasValue false when value is null', () => {
    tester.componentInstance.prepare('sqlite');
    tester.componentInstance.setData(itemLastValueNoValue, 'Test Group');
    expect(tester.componentInstance.hasValue).toBe(false);
  });

  it('should have isFileArray false for generic object value', () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    expect(tester.componentInstance.isFileArray).toBe(false);
  });

  it('should have isFileArray true for array of objects with filename', () => {
    tester.componentInstance.prepare('folder-scanner');
    tester.componentInstance.setData(itemLastValueWithFileArray, 'Test Group');
    expect(tester.componentInstance.isFileArray).toBe(true);
  });

  it('should return fileArray for file-like value', () => {
    tester.componentInstance.prepare('folder-scanner');
    tester.componentInstance.setData(itemLastValueWithFileArray, 'Test Group');
    const files = tester.componentInstance.fileArray;
    expect(files.length).toBe(2);
    expect(files[0].filename).toBe('file1.txt');
    expect(files[0].modifiedTime).toBe(1706950800000);
    expect(files[1].filename).toBe('file2.csv');
    expect(files[1].modifiedTime).toBe(1706950900000);
  });

  it('should return empty fileArray when not file array', () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    expect(tester.componentInstance.fileArray).toEqual([]);
  });

  it('should display file table when value is file array', async () => {
    tester.componentInstance.prepare('folder-scanner');
    tester.componentInstance.setData(itemLastValueWithFileArray, 'Test Group');
    await tester.change();

    expect(tester.modalBody.textContent).toContain('file1.txt');
    expect(tester.modalBody.textContent).toContain('file2.csv');
    expect(tester.modalBody.textContent).toContain('2 file(s) tracked');
  });

  it('should display JSON for generic value', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    expect(tester.modalBody.textContent).toContain('foo');
    expect(tester.modalBody.textContent).toContain('bar');
    expect(tester.modalBody.textContent).toContain('42');
  });

  it('should display item name when prepared with no value', async () => {
    tester.componentInstance.prepare('sqlite');
    tester.componentInstance.setData(itemLastValueNoValue, 'Test Group');
    await tester.change();

    expect(tester.modalBody.textContent).toContain('Empty Item');
  });

  // --- isGroupedConnector ---

  it('should have isGroupedConnector true for a grouped connector type', () => {
    tester.componentInstance.prepare('opcua');
    expect(tester.componentInstance.isGroupedConnector).toBe(true);
  });

  it('should have isGroupedConnector false for a single-item connector type', () => {
    tester.componentInstance.prepare('sqlite');
    expect(tester.componentInstance.isGroupedConnector).toBe(false);
  });

  it('should show group-value notice for grouped connectors', async () => {
    tester.componentInstance.prepare('opcua');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    expect(tester.infoAlert).not.toBeNull();
  });

  it('should not show group-value notice for single-item connectors', async () => {
    tester.componentInstance.prepare('sqlite');
    tester.componentInstance.setData(itemLastValueWithValue, 'Test Group');
    await tester.change();

    expect(tester.infoAlert).toBeNull();
  });
});
