import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from './edit-south-item-group-modal.component';

const manifest = testData.south.manifest;
const opcuaManifest: SouthConnectorManifest = { ...manifest, id: 'opcua' };
const mqttManifest: SouthConnectorManifest = { ...manifest, id: 'mqtt' };
const noHistoryManifest: SouthConnectorManifest = { ...manifest, modes: { ...manifest.modes, history: false } };
const scanModes = testData.scanMode.list;

class EditSouthItemGroupModalComponentTester {
  readonly fixture = TestBed.createComponent(EditSouthItemGroupModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly name = this.root.getByLabelText('Group name');
  readonly scanMode = this.root.getByLabelText('Schedule');
  readonly maxReadInterval = this.root.getByLabelText('Max read interval');
  readonly readDelay = this.root.getByLabelText('Read delay');
  readonly startTimeOffset = this.root.getByLabelText('Default start time offset');
  readonly endTimeOffset = this.root.getByLabelText('Default end time offset');
  readonly recoveryStrategy = this.root.getByLabelText('Recovery strategy');
  readonly cachingStrategy = this.root.getByLabelText('Caching strategy');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly mustBeUnique = this.root.getByText('Must be unique');
  readonly nameRequired = this.root.getByText('This field is required');
}

describe('EditSouthItemGroupModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let unsavedChangesService: MockObject<UnsavedChangesConfirmationService>;
  let existingGroup: SouthItemGroupDTO;
  let otherGroup: SouthItemGroupDTO;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    existingGroup = buildSouthItemGroup('group1', 'GroupA', scanModes[1], {
      historySettings: {
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        cachingStrategy: null
      }
    });
    otherGroup = buildSouthItemGroup('group2', 'GroupB');

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  function openForCreation(groupManifest: SouthConnectorManifest = manifest) {
    const tester = new EditSouthItemGroupModalComponentTester();
    tester.fixture.componentInstance.prepareForCreation(scanModes, [existingGroup, otherGroup], groupManifest);
    return tester;
  }

  function openForEdition(group: SouthItemGroupDTO | SouthItemGroupCommandDTO = existingGroup) {
    const tester = new EditSouthItemGroupModalComponentTester();
    tester.fixture.componentInstance.prepareForEdition(scanModes, [existingGroup, otherGroup], manifest, group);
    return tester;
  }

  test.each([
    { mode: 'create', open: () => openForCreation(), title: 'Create a new group', name: '' },
    { mode: 'edit', open: () => openForEdition(), title: 'Edit group', name: 'GroupA' }
  ])('should default the historian fields in $mode mode', async ({ open, title, name }) => {
    const tester = open();

    await expect.element(tester.title).toHaveTextContent(title);
    await expect.element(tester.name).toHaveValue(name);
    await expect.element(tester.maxReadInterval).toHaveValue(3600);
    await expect.element(tester.readDelay).toHaveValue(200);
    await expect.element(tester.startTimeOffset).toHaveValue(0);
    await expect.element(tester.endTimeOffset).toHaveValue(0);
    await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From oldest to newest');
  });

  test('should populate the form with the edited group', async () => {
    const group = buildSouthItemGroupCommand('group1', 'GroupA', scanModes[1].id, {
      historySettings: {
        startTimeOffset: -100,
        endTimeOffset: 100,
        maxReadInterval: 60,
        readDelay: 10,
        recoveryStrategy: 'newest',
        cachingStrategy: null
      }
    });
    const tester = openForEdition(group);

    await expect.element(tester.scanMode).toHaveDisplayValue(scanModes[1].name);
    await expect.element(tester.maxReadInterval).toHaveValue(60);
    await expect.element(tester.readDelay).toHaveValue(10);
    await expect.element(tester.startTimeOffset).toHaveValue(-100);
    await expect.element(tester.endTimeOffset).toHaveValue(100);
  });

  test('should close with a create command', async () => {
    const tester = openForCreation();

    await tester.name.fill('GroupC');
    await tester.scanMode.selectOptions(scanModes[0].name);
    await tester.maxReadInterval.fill('60');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      mode: 'create',
      group: {
        id: '',
        standardSettings: { name: 'GroupC', scanModeId: scanModes[0].id },
        historySettings: {
          startTimeOffset: 0,
          endTimeOffset: 0,
          maxReadInterval: 60,
          readDelay: 200,
          recoveryStrategy: 'oldest',
          cachingStrategy: 'allValues'
        }
      }
    });
  });

  test('should close with an edit command keeping the group id', async () => {
    const tester = openForEdition();

    await tester.name.fill('GroupA renamed');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      mode: 'edit',
      group: {
        id: 'group1',
        standardSettings: { name: 'GroupA renamed', scanModeId: scanModes[1].id },
        historySettings: {
          startTimeOffset: 0,
          endTimeOffset: 0,
          maxReadInterval: 3600,
          readDelay: 200,
          recoveryStrategy: 'oldest',
          cachingStrategy: 'allValues'
        }
      }
    });
  });

  test('should not save an invalid group', async () => {
    const tester = openForCreation();

    await tester.saveButton.click();

    await expect.element(tester.nameRequired.first()).toBeInTheDocument();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should reject the name of another group, ignoring case', async () => {
    const tester = openForCreation();

    await tester.name.fill('groupb');
    await tester.scanMode.selectOptions(scanModes[0].name);
    await tester.saveButton.click();

    await expect.element(tester.mustBeUnique).toBeInTheDocument();
    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should accept the edited group its own name', async () => {
    const tester = openForEdition();

    await tester.name.fill('groupa');
    await tester.saveButton.click();

    await expect.element(tester.mustBeUnique).not.toBeInTheDocument();
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should hide the historian fields when the connector has no history mode', async () => {
    const tester = openForCreation(noHistoryManifest);

    await expect.element(tester.name).toBeInTheDocument();
    await expect.element(tester.maxReadInterval).not.toBeInTheDocument();
    await expect.element(tester.recoveryStrategy).not.toBeInTheDocument();
  });

  test('should only offer the caching strategy to IoT connectors, threshold included', async () => {
    const tester = openForCreation(opcuaManifest);

    await tester.cachingStrategy.selectOptions('Threshold');

    await expect.element(tester.cachingStrategy).toHaveDisplayValue('Threshold');
    const notIotTester = openForCreation();
    await expect.element(notIotTester.name).toBeInTheDocument();
    await expect.element(notIotTester.cachingStrategy).not.toBeInTheDocument();
  });

  test('should not offer the threshold caching strategy to MQTT connectors', async () => {
    const tester = openForCreation(mqttManifest);

    await expect.element(tester.cachingStrategy).toBeInTheDocument();
    await expect.element(tester.cachingStrategy.getByRole('option', { name: 'Threshold' })).not.toBeInTheDocument();
  });

  test('should label the confirm button "OK" when changes are kept in memory', async () => {
    const tester = new EditSouthItemGroupModalComponentTester();
    tester.fixture.componentInstance.directSave = false;
    tester.fixture.componentInstance.prepareForCreation(scanModes, [], manifest);

    await expect.element(tester.okButton).toBeInTheDocument();
  });

  test('should dismiss on cancel', async () => {
    const tester = openForCreation();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should only ask for confirmation before dismissing when there are unsaved changes', async () => {
    const tester = openForEdition();
    await expect.element(tester.name).toHaveValue('GroupA');
    expect(tester.fixture.componentInstance.canDismiss()).toBe(true);

    const confirmation = of(false);
    unsavedChangesService.confirmUnsavedChanges.mockReturnValue(confirmation);
    await tester.name.fill('changed');

    expect(tester.fixture.componentInstance.canDismiss()).toBe(confirmation);
  });
});
