import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SelectGroupModalComponent } from './select-group-modal.component';
import { SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { of, throwError, EMPTY } from 'rxjs';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';

class SelectGroupModalComponentTester extends ComponentTester<SelectGroupModalComponent> {
  constructor() {
    super(SelectGroupModalComponent);
  }

  get groupSelect() {
    return this.button('#group-select')!;
  }

  get save() {
    return this.button('.btn-primary')!;
  }

  get cancel() {
    return this.button('.btn-cancel')!;
  }

  get form() {
    return this.element('#form')!;
  }
}

describe('SelectGroupModalComponent', () => {
  let tester: SelectGroupModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let modalService: jasmine.SpyObj<ModalService>;

  const groups: Array<SouthItemGroupDTO> = [
    {
      id: 'group1',
      name: 'Group 1',
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    },
    {
      id: 'group2',
      name: 'Group 2',
      scanMode: testData.scanMode.list[1],
      shareTrackedInstant: true,
      overlap: 100
    }
  ];

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: ModalService, useValue: modalService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new SelectGroupModalComponentTester();
    tester.componentInstance.prepare([...groups], 'southId1', testData.scanMode.list, testData.south.manifest);
    await tester.change();
  });

  it('should initialize with no group selected', () => {
    expect(tester.componentInstance.form.controls.groupId.value).toBeNull();
    expect(tester.componentInstance.getSelectedGroupName()).toBe('south.items.group-none');
  });

  it('should display groups in dropdown', async () => {
    tester.groupSelect.click();
    await tester.change();
    const dropdownItems = tester.elements('button[ngbDropdownItem]');
    expect(dropdownItems.length).toBeGreaterThan(0);
  });

  it('should select a group', async () => {
    tester.componentInstance.selectGroup('group1');
    await tester.change();
    expect(tester.componentInstance.form.controls.groupId.value).toBe('group1');
    expect(tester.componentInstance.getSelectedGroupName()).toBe('Group 1');
  });

  it('should select null group', () => {
    tester.componentInstance.selectGroup(null);
    expect(tester.componentInstance.form.controls.groupId.value).toBeNull();
    expect(tester.componentInstance.getSelectedGroupName()).toBe('south.items.group-none');
  });

  it('should save with selected group', async () => {
    tester.componentInstance.selectGroup('group1');
    await tester.change();
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith('group1');
  });

  it('should save with null group', async () => {
    tester.componentInstance.selectGroup(null);
    await tester.change();
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith(null);
  });

  it('should cancel', async () => {
    await tester.change();
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should open create new group modal', () => {
    const mockModalRef = {
      componentInstance: {
        prepareForCreation: jasmine.createSpy('prepareForCreation')
      },
      result: EMPTY
    };
    modalService.open.and.returnValue(mockModalRef as any);

    tester.componentInstance.onCreateNewGroup();

    expect(modalService.open).toHaveBeenCalledWith(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    expect(mockModalRef.componentInstance.prepareForCreation).toHaveBeenCalledWith(
      'southId1',
      testData.scanMode.list,
      testData.south.manifest,
      groups,
      false // inMemoryMode
    );
  });

  it('should add new group to list when created', fakeAsync(async () => {
    const newGroup: SouthItemGroupDTO = {
      id: 'newGroup',
      name: 'New Group',
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };
    const mockModalRef = {
      componentInstance: {
        prepareForCreation: jasmine.createSpy('prepareForCreation')
      },
      result: of(newGroup)
    };
    modalService.open.and.returnValue(mockModalRef as any);

    const initialGroupsCount = tester.componentInstance.groups.length;
    tester.componentInstance.onCreateNewGroup();
    tick(); // Process the observable emission
    await tester.change();

    expect(tester.componentInstance.groups.length).toBe(initialGroupsCount + 1);
    expect(tester.componentInstance.groups[initialGroupsCount]).toEqual(newGroup);
    expect(tester.componentInstance.form.controls.groupId.value).toBe('newGroup');
  }));

  it('should not add group if modal is dismissed', () => {
    const mockModalRef = {
      componentInstance: {
        prepareForCreation: jasmine.createSpy('prepareForCreation')
      },
      result: throwError(() => new Error('Modal dismissed'))
    };
    modalService.open.and.returnValue(mockModalRef as any);

    const initialGroupsCount = tester.componentInstance.groups.length;
    tester.componentInstance.onCreateNewGroup();

    expect(tester.componentInstance.groups.length).toBe(initialGroupsCount);
  });
});
