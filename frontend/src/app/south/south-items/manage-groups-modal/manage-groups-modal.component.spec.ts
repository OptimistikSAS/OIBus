import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { DownloadService } from '../../../services/download.service';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import ManageGroupsModalComponent from './manage-groups-modal.component';

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list;

class ManageGroupsModalComponentTester {
  readonly fixture = TestBed.createComponent(ManageGroupsModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly addButton = this.root.getByRole('button', { name: 'Create a new group' });
  readonly exportButton = this.root.getByRole('button', { name: 'Export' });
  readonly importInput = this.root.getByLabelText('Import');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
  readonly search = this.root.getByPlaceholder('Search groups by name');
  readonly scheduleFilter = this.root.getByRole('combobox', { name: 'Schedule' });
  readonly nameHeader = this.root.getByRole('button', { name: 'Group name' });
  readonly scheduleHeader = this.root.getByRole('button', { name: 'Schedule' });
  readonly itemCountHeader = this.root.getByRole('button', { name: 'Items' });
  readonly rows = this.root.getByCss('tbody tr');
  readonly noGroup = this.root.getByText('No groups configured');
  readonly noMatch = this.root.getByText('No groups match the current filters');

  row(index: number) {
    return this.rows.nth(index);
  }
}

describe('ManageGroupsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let downloadService: MockObject<DownloadService>;
  let groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
  let addOrEditGroup: Mock<AddOrEditGroup>;
  let deleteGroup: Mock<DeleteGroup>;
  let getItemCount: Mock<(groupId: string) => number>;
  let tester: ManageGroupsModalComponentTester;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    downloadService = createMock(DownloadService);
    groups = [buildSouthItemGroup('group1', 'Alpha', scanModes[1]), buildSouthItemGroup('group2', 'Beta', scanModes[0])];
    addOrEditGroup = vi.fn<AddOrEditGroup>();
    deleteGroup = vi.fn<DeleteGroup>();
    getItemCount = vi.fn((groupId: string) => (groupId === 'group1' ? 5 : 1));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: DownloadService, useValue: downloadService }
      ]
    });

    tester = new ManageGroupsModalComponentTester();
  });

  function prepare(directSave = true) {
    tester.fixture.componentInstance.prepare(groups, scanModes, manifest, directSave, getItemCount, addOrEditGroup, deleteGroup);
  }

  test('should render every group with its schedule, history settings and item count', async () => {
    prepare();

    await expect.element(tester.title).toHaveTextContent('Groups (2)');
    await expect.element(tester.rows).toHaveLength(2);
    const alpha = tester.row(0);
    await expect.element(alpha.getByRole('cell').nth(0)).toHaveTextContent('Alpha');
    await expect.element(alpha.getByRole('cell').nth(1)).toHaveTextContent(scanModes[1].name);
    await expect.element(alpha.getByRole('cell').nth(4)).toHaveTextContent('3600s');
    await expect.element(alpha.getByRole('cell').nth(5)).toHaveTextContent('200ms');
    await expect.element(alpha.getByRole('cell').nth(6)).toHaveTextContent('From oldest to newest');
    await expect.element(alpha.getByRole('cell').nth(7)).toHaveTextContent('5');
    await expect.element(tester.row(1).getByRole('cell').nth(7)).toHaveTextContent('1');
  });

  test('should show a message when there is no group', async () => {
    groups = [];
    prepare();

    await expect.element(tester.noGroup).toBeInTheDocument();
    await expect.element(tester.exportButton).toBeDisabled();
  });

  test('should filter groups by name', async () => {
    prepare();

    await tester.search.fill('alp');
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent('Alpha');

    await tester.search.fill('nothing');
    await expect.element(tester.noMatch).toBeInTheDocument();
  });

  test('should filter groups by schedule', async () => {
    prepare();

    await tester.scheduleFilter.selectOptions(scanModes[0].name);

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent('Beta');
  });

  test('should sort groups by name, ascending then descending', async () => {
    prepare();

    await tester.nameHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Alpha');

    await tester.nameHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Beta');
  });

  test('should sort groups by schedule name', async () => {
    prepare();

    await tester.scheduleHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Beta');

    await tester.scheduleHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Alpha');
  });

  test('should sort groups by item count, then go back to the original order', async () => {
    prepare();

    await tester.itemCountHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Beta');

    await tester.itemCountHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Alpha');

    // a third click resets the sort, a click on another column starts sorting it ascending
    await tester.itemCountHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Alpha');
    await tester.nameHeader.click();
    await tester.itemCountHeader.click();
    await expect.element(tester.row(0)).toMatchTextContent('Beta');
  });

  test('should create a group and add it to the shared list', async () => {
    prepare(false);
    const command = buildSouthItemGroupCommand(null, 'Gamma');
    const createdGroup = buildSouthItemGroupCommand('group3', 'Gamma');
    const groupModal = createMock(EditSouthItemGroupModalComponent);
    TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'create', group: command });
    addOrEditGroup.mockReturnValue(of(createdGroup));

    await tester.addButton.click();

    expect(groupModal.directSave).toBe(false);
    expect(groupModal.prepareForCreation).toHaveBeenCalledWith(scanModes, groups, manifest);
    expect(addOrEditGroup).toHaveBeenCalledWith({ mode: 'create', group: command });
    expect(groups).toContain(createdGroup);
    await expect.element(tester.title).toHaveTextContent('Groups (3)');
    await expect.element(tester.rows).toHaveLength(3);
    await expect.element(tester.row(2)).toMatchTextContent('Gamma');
  });

  test('should edit a group and replace it in the shared list', async () => {
    prepare();
    const command = buildSouthItemGroupCommand('group1', 'Alpha renamed');
    const updatedGroup = buildSouthItemGroup('group1', 'Alpha renamed', scanModes[1]);
    const groupModal = createMock(EditSouthItemGroupModalComponent);
    TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'edit', group: command });
    addOrEditGroup.mockReturnValue(of(updatedGroup));
    const editedGroup = groups[0];

    await tester.row(0).getByRole('button', { name: 'Edit group' }).click();

    expect(groupModal.directSave).toBe(true);
    expect(groupModal.prepareForEdition).toHaveBeenCalledWith(scanModes, groups, manifest, editedGroup);
    expect(addOrEditGroup).toHaveBeenCalledWith({ mode: 'edit', group: command });
    expect(groups[0]).toBe(updatedGroup);
    await expect.element(tester.row(0)).toMatchTextContent('Alpha renamed');
    await expect.element(tester.rows).toHaveLength(2);
  });

  test('should delete a group and remove it from the shared list', async () => {
    prepare();
    deleteGroup.mockReturnValue(of(undefined));
    const deletedGroup = groups[0];

    await tester.row(0).getByRole('button', { name: 'Delete' }).click();

    expect(deleteGroup).toHaveBeenCalledWith(deletedGroup);
    expect(groups.map(group => group.id)).toEqual(['group2']);
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.title).toHaveTextContent('Groups (1)');
  });

  test('should close the modal', async () => {
    prepare();

    await tester.closeButton.click();

    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should export the groups as a CSV file', async () => {
    prepare();

    await tester.exportButton.click();

    expect(downloadService.downloadFile).toHaveBeenCalledWith({ blob: expect.any(Blob), name: expect.stringMatching(/^groups_.*\.csv$/) });
    const content = await downloadService.downloadFile.mock.lastCall![0].blob.text();
    expect(content.split('\r\n')).toEqual([
      'name,scanMode,startTimeOffset,endTimeOffset,maxReadInterval,readDelay,recoveryStrategy',
      `Alpha,${scanModes[1].name},0,0,3600,200,oldest`,
      `Beta,${scanModes[0].name},0,0,3600,200,oldest`
    ]);
  });

  test('should import the valid groups of a CSV file and report the created count', async () => {
    prepare();
    addOrEditGroup.mockImplementation(command => of({ ...command.group, id: 'imported1' }));
    const csvContent = [
      'name,scanMode,startTimeOffset,endTimeOffset,maxReadInterval,readDelay,recoveryStrategy',
      `Gamma,${scanModes[0].name},-1000,0,3600,200,newest`
    ].join('\n');

    await tester.importInput.upload(new File([csvContent], 'groups.csv', { type: 'text/csv' }));

    await expect.element(tester.root.getByText('1 group(s) imported')).toBeInTheDocument();
    expect(addOrEditGroup).toHaveBeenCalledWith({
      mode: 'create',
      group: {
        id: null,
        standardSettings: { name: 'Gamma', scanModeId: scanModes[0].id },
        historySettings: {
          startTimeOffset: -1000,
          endTimeOffset: 0,
          maxReadInterval: 3600,
          readDelay: 200,
          recoveryStrategy: 'newest',
          cachingStrategy: null
        }
      }
    });
    expect(groups.map(group => group.id)).toEqual(['group1', 'group2', 'imported1']);
    await expect.element(tester.rows).toHaveLength(3);
  });

  test('should report the invalid rows of a CSV file without importing them', async () => {
    prepare();
    const csvContent = [
      'name,scanMode,startTimeOffset,endTimeOffset,maxReadInterval,readDelay',
      `,${scanModes[0].name},0,0,3600,200`,
      `alpha,${scanModes[0].name},0,0,3600,200`,
      'Delta,unknown-scan-mode,0,0,3600,200'
    ].join('\n');

    await tester.importInput.upload(new File([csvContent], 'groups.csv', { type: 'text/csv' }));

    const errors = tester.root.getByRole('alert');
    await expect.element(errors).toMatchTextContent('3 row(s) could not be imported');
    await expect.element(errors).toMatchTextContent('Row 1: Group name is required');
    await expect.element(errors).toMatchTextContent('Row 2: A group named "alpha" already exists');
    await expect.element(errors).toMatchTextContent('Row 3: Scan mode "unknown-scan-mode" was not found');
    expect(addOrEditGroup).not.toHaveBeenCalled();
    await expect.element(tester.rows).toHaveLength(2);
  });
});
