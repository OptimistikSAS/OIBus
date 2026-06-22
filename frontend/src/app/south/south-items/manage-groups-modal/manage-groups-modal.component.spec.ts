import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MockedFunction } from '@vitest/spy';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import ManageGroupsModalComponent from './manage-groups-modal.component';
import { ModalService } from '../../../shared/modal.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;

const buildGroup = (id: string, name: string, scanMode: ScanModeDTO): SouthItemGroupDTO => ({
  id,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: { name, scanMode },
  historySettings: { overlap: 0, maxReadInterval: 3600, readDelay: 200, recoveryStrategy: null }
});

describe('ManageGroupsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let modalService: MockObject<ModalService>;
  let groups: Array<SouthItemGroupDTO>;
  let addOrEditGroup: MockedFunction<
    (command: { mode: 'create' | 'edit'; group: SouthItemGroupCommandDTO }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>
  >;
  let deleteGroup: MockedFunction<(group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>>;
  let getItemCount: MockedFunction<(groupId: string) => number>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    modalService = createMock(ModalService);
    groups = [buildGroup('group1', 'Alpha', scanModes[0]), buildGroup('group2', 'Beta', scanModes[1])];
    addOrEditGroup = vi.fn();
    deleteGroup = vi.fn();
    getItemCount = vi.fn().mockReturnValue(0);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ManageGroupsModalComponent);
    fixture.componentInstance.prepare(groups, scanModes, manifest, true, getItemCount, addOrEditGroup, deleteGroup);
    fixture.detectChanges();
    return fixture;
  }

  test('should render all groups with their item count', async () => {
    getItemCount.mockImplementation((groupId: string) => (groupId === 'group1' ? 3 : 0));
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toHaveTextContent('Groups (2)');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Alpha');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Beta');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('3');
  });

  test('should filter groups by search text', () => {
    const fixture = createComponent();

    fixture.componentInstance.searchControl.setValue('alp');

    expect(fixture.componentInstance.displayedGroups.map(group => group.standardSettings.name)).toEqual(['Alpha']);
  });

  test('should filter groups by schedule', () => {
    const fixture = createComponent();

    fixture.componentInstance.scheduleFilterControl.setValue(scanModes[1].id);

    expect(fixture.componentInstance.displayedGroups.map(group => group.standardSettings.name)).toEqual(['Beta']);
  });

  test('should sort groups by name ascending then descending', () => {
    const fixture = createComponent();

    fixture.componentInstance.toggleColumnSort('name');
    expect(fixture.componentInstance.displayedGroups.map(group => group.standardSettings.name)).toEqual(['Alpha', 'Beta']);

    fixture.componentInstance.toggleColumnSort('name');
    expect(fixture.componentInstance.displayedGroups.map(group => group.standardSettings.name)).toEqual(['Beta', 'Alpha']);
  });

  test('should sort groups by item count', () => {
    getItemCount.mockImplementation((groupId: string) => (groupId === 'group1' ? 1 : 5));
    const fixture = createComponent();

    fixture.componentInstance.toggleColumnSort('itemCount');
    expect(fixture.componentInstance.displayedGroups.map(group => group.id)).toEqual(['group1', 'group2']);

    fixture.componentInstance.toggleColumnSort('itemCount');
    expect(fixture.componentInstance.displayedGroups.map(group => group.id)).toEqual(['group2', 'group1']);
  });

  test('should open the create group modal and append the created group', () => {
    const createdGroup: SouthItemGroupCommandDTO = {
      id: 'group3',
      standardSettings: { name: 'Gamma', scanModeId: scanModes[0].id },
      historySettings: { overlap: 0, maxReadInterval: 3600, readDelay: 200, recoveryStrategy: null }
    };
    const fakeModal = {
      componentInstance: { directSave: false, prepareForCreation: vi.fn() },
      result: of({ mode: 'create', group: createdGroup })
    };
    modalService.open.mockReturnValue(fakeModal as any);
    addOrEditGroup.mockReturnValue(of(createdGroup));
    const fixture = createComponent();

    fixture.componentInstance.onAddGroup();

    expect(addOrEditGroup).toHaveBeenCalledWith({ mode: 'create', group: createdGroup });
    expect(fixture.componentInstance.groups).toContain(createdGroup);
  });

  test('should open the edit group modal and replace the edited group', () => {
    const updatedGroup: SouthItemGroupCommandDTO = {
      id: 'group1',
      standardSettings: { name: 'Alpha renamed', scanModeId: scanModes[0].id },
      historySettings: { overlap: 0, maxReadInterval: 3600, readDelay: 200, recoveryStrategy: null }
    };
    const fakeModal = {
      componentInstance: { directSave: false, prepareForEdition: vi.fn() },
      result: of({ mode: 'edit', group: updatedGroup })
    };
    modalService.open.mockReturnValue(fakeModal as any);
    addOrEditGroup.mockReturnValue(of(updatedGroup));
    const fixture = createComponent();

    fixture.componentInstance.onEditGroup(groups[0]);

    expect(fixture.componentInstance.groups.find(group => group.id === 'group1')).toBe(updatedGroup);
  });

  test('should delete a group and remove it from the list', () => {
    deleteGroup.mockReturnValue(of(undefined));
    const fixture = createComponent();
    const groupToDelete = groups[0];

    fixture.componentInstance.onDeleteGroup(groupToDelete);

    expect(deleteGroup).toHaveBeenCalledWith(groupToDelete);
    expect(fixture.componentInstance.groups.find(group => group.id === 'group1')).toBeUndefined();
    expect(fixture.componentInstance.displayedGroups.find(group => group.id === 'group1')).toBeUndefined();
  });

  test('should close the modal', () => {
    const fixture = createComponent();

    fixture.componentInstance.close();

    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should export groups as a CSV file', () => {
    const fixture = createComponent();
    const linkSpy = { click: vi.fn(), href: '', download: '' };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    vi.spyOn(document, 'createElement').mockReturnValue(linkSpy as unknown as HTMLElement);

    fixture.componentInstance.exportGroups();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(linkSpy.href).toBe('mock-url');
    expect(linkSpy.download).toMatch(/^groups_.*\.csv$/);
    expect(linkSpy.click).toHaveBeenCalled();
  });

  test('should import valid groups from a CSV file and report the created count', async () => {
    addOrEditGroup.mockImplementation(command => of({ ...command.group, id: 'imported1' }));
    const fixture = createComponent();

    const csvContent = `name,scanMode,overlap,maxReadInterval,readDelay\nGamma,${scanModes[0].name},0,3600,200`;
    const file = new File([csvContent], 'groups.csv', { type: 'text/csv' });
    await fixture.componentInstance.onImportFileSelected({ target: { files: [file], value: '' } } as unknown as Event);

    expect(addOrEditGroup).toHaveBeenCalledWith({
      mode: 'create',
      group: {
        id: null,
        standardSettings: { name: 'Gamma', scanModeId: scanModes[0].id },
        historySettings: { overlap: 0, maxReadInterval: 3600, readDelay: 200 }
      }
    });
    expect(fixture.componentInstance.importSuccessCount).toBe(1);
    expect(fixture.componentInstance.importErrors).toEqual([]);
    expect(fixture.componentInstance.groups.some(group => group.id === 'imported1')).toBe(true);
  });

  test('should report errors for invalid rows without importing them', async () => {
    const fixture = createComponent();

    const csvContent = [
      'name,scanMode,overlap,maxReadInterval,readDelay',
      `,${scanModes[0].name},0,3600,200`,
      `Alpha,${scanModes[0].name},0,3600,200`,
      'Delta,unknown-scan-mode,0,3600,200'
    ].join('\n');
    const file = new File([csvContent], 'groups.csv', { type: 'text/csv' });
    await fixture.componentInstance.onImportFileSelected({ target: { files: [file], value: '' } } as unknown as Event);

    expect(addOrEditGroup).not.toHaveBeenCalled();
    expect(fixture.componentInstance.importErrors).toHaveLength(3);
    expect(fixture.componentInstance.importSuccessCount).toBeNull();
  });
});
