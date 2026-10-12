import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { FakeSouthItemGroups, fakeSouthItemGroups } from '../south-item-groups.testing';
import { SelectGroupModalComponent } from './select-group-modal.component';

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list;

class SelectGroupModalComponentTester {
  readonly fixture = TestBed.createComponent(SelectGroupModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly groupToggle = this.root.getByRole('button', { name: 'Select group' });
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly createGroupButton = this.root.getByRole('button', { name: 'Create a new group...' });

  groupOption(name: string) {
    return this.root.getByRole('button', { name, exact: true });
  }
}

describe('SelectGroupModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let groups: FakeSouthItemGroups;
  let tester: SelectGroupModalComponentTester;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    groups = fakeSouthItemGroups([buildSouthItemGroup('group1', 'GroupA'), buildSouthItemGroup('group2', 'GroupB')]);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideModalTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });

    tester = new SelectGroupModalComponentTester();
    tester.fixture.componentInstance.prepare(groups, scanModes, manifest);
  });

  test('should select no group by default and close with null', async () => {
    await expect.element(tester.groupToggle).toHaveTextContent('None');

    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(null);
  });

  test('should list the groups and close with the selected one', async () => {
    await tester.groupToggle.click();
    await expect.element(tester.groupOption('GroupA')).toBeInTheDocument();
    await tester.groupOption('GroupB').click();
    await expect.element(tester.groupToggle).toHaveTextContent('GroupB');

    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith('group2');
  });

  test('should go back to no group', async () => {
    await tester.groupToggle.click();
    await tester.groupOption('GroupA').click();
    await tester.groupToggle.click();
    await tester.groupOption('None').click();

    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(null);
  });

  test('should dismiss on cancel', async () => {
    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should create a group through the groups of the page and select it', async () => {
    const command = buildSouthItemGroupCommand(null, 'GroupC');
    const groupModal = createMock(EditSouthItemGroupModalComponent);
    TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'create', group: command });
    const listedGroups = groups.list();

    await tester.groupToggle.click();
    await tester.createGroupButton.click();

    expect(groupModal.prepareForCreation).toHaveBeenCalledWith(scanModes, listedGroups, manifest);
    expect(groups.save).toHaveBeenCalledWith({ mode: 'create', group: command });
    await expect.element(tester.groupToggle).toHaveTextContent('GroupC');
    await tester.groupToggle.click();
    await expect.element(tester.groupOption('GroupC')).toBeInTheDocument();
    await tester.groupToggle.click();

    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith('created-1');
  });

  test('should show the groups changed by the page', async () => {
    groups.list.update(list => [...list, buildSouthItemGroup('group3', 'GroupC')]);

    await tester.groupToggle.click();

    await expect.element(tester.groupOption('GroupC')).toBeInTheDocument();
  });

  test('should keep the current selection when the group creation fails', async () => {
    const groupModal = createMock(EditSouthItemGroupModalComponent);
    TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'create', group: buildSouthItemGroupCommand(null, 'GroupC') });
    groups.save.mockReturnValue(throwError(() => new Error('creation failed')));

    await tester.groupToggle.click();
    await tester.createGroupButton.click();

    expect(groups.save).toHaveBeenCalled();
    await expect.element(tester.groupToggle).toHaveTextContent('None');
  });
});
