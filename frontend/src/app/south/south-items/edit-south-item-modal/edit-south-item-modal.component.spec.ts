import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '@oibus/shared/api/south-connector.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import EditSouthItemModalComponent from './edit-south-item-modal.component';

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

const manifest = testData.south.manifest;
const opcuaManifest: SouthConnectorManifest = { ...manifest, id: 'opcua' };
const mqttManifest: SouthConnectorManifest = { ...manifest, id: 'mqtt' };
const subscriptionManifest: SouthConnectorManifest = {
  ...manifest,
  items: {
    ...manifest.items,
    rootAttribute: {
      ...manifest.items.rootAttribute,
      attributes: manifest.items.rootAttribute.attributes.map(attribute =>
        attribute.key === 'scanMode' ? { ...(attribute as OIBusScanModeAttribute), acceptableType: 'SUBSCRIPTION' } : attribute
      )
    }
  }
};
const southConnectorCommand = testData.south.command;
const scanModes = testData.scanMode.list;
const southId = testData.south.list[0].id;
const [savedItem1, savedItem2] = testData.south.list[0].items;

class EditSouthItemModalComponentTester {
  readonly fixture = TestBed.createComponent(EditSouthItemModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly groupToggle = this.root.getByRole('button', { name: 'Group', exact: true });
  readonly scanMode = this.root.getByLabelText('Schedule');
  readonly enabled = this.root.getByLabelText('Enabled');
  readonly syncWithGroup = this.root.getByLabelText('Sync with group');
  readonly maxReadInterval = this.root.getByLabelText('Max read interval');
  readonly readDelay = this.root.getByLabelText('Read delay');
  readonly startTimeOffset = this.root.getByLabelText('Start time offset');
  readonly endTimeOffset = this.root.getByLabelText('End time offset');
  readonly recoveryStrategy = this.root.getByLabelText('Recovery strategy');
  readonly cachingStrategy = this.root.getByLabelText('Caching strategy');
  readonly thresholdType = this.root.getByLabelText('Threshold type');
  readonly threshold = this.root.getByLabelText('Threshold', { exact: true });
  readonly rangeLow = this.root.getByLabelText('Range low');
  readonly rangeHigh = this.root.getByLabelText('Range high');
  readonly maxCachingInterval = this.root.getByLabelText('Max caching interval');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly cancelButton = this.root.getByCss('.modal-footer').getByRole('button', { name: 'Cancel' });
  readonly createGroupButton = this.root.getByRole('button', { name: 'Create a new group...' });
  readonly mustBeUnique = this.root.getByText('Must be unique');

  groupOption(name: string) {
    return this.root.getByRole('button', { name, exact: true });
  }

  groupRowButton(groupName: string, name: 'Edit group' | 'Delete') {
    return this.root.getByCss('.group-row').filter({ hasText: groupName }).getByRole('button', { name });
  }

  async selectGroup(name: string) {
    await this.groupToggle.click();
    await this.groupOption(name).click();
  }
}

describe('EditSouthItemModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let unsavedChangesService: MockObject<UnsavedChangesConfirmationService>;
  let addOrEditGroup: Mock<AddOrEditGroup>;
  let deleteGroup: Mock<DeleteGroup>;
  let groupA: SouthItemGroupDTO;
  let groupB: SouthItemGroupDTO;
  let groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    addOrEditGroup = vi.fn<AddOrEditGroup>();
    deleteGroup = vi.fn<DeleteGroup>();
    groupA = buildSouthItemGroup('group1', 'GroupA', scanModes[0], {
      historySettings: {
        startTimeOffset: 500,
        endTimeOffset: 600,
        maxReadInterval: 60,
        readDelay: 10,
        recoveryStrategy: 'newest',
        cachingStrategy: null
      }
    });
    groupB = buildSouthItemGroup('group2', 'GroupB', scanModes[1]);
    groups = [groupA, groupB];

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  interface OpenOptions {
    item?: SouthConnectorItemDTO | SouthConnectorItemCommandDTO;
    itemList?: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>;
    itemManifest?: SouthConnectorManifest;
    tableIndex?: number;
    directSave?: boolean;
  }

  /** Opens the modal like its openers do: for creation, or for edition / copy of `item`. */
  function open(mode: 'create' | 'edit' | 'copy', options: OpenOptions = {}) {
    const { item = savedItem1, itemList = [], itemManifest = manifest, tableIndex = 0, directSave = true } = options;
    const tester = new EditSouthItemModalComponentTester();
    const component = tester.fixture.componentInstance;
    component.directSave = directSave;
    switch (mode) {
      case 'create':
        component.prepareForCreation(
          itemList,
          scanModes,
          [],
          groups,
          itemManifest,
          southId,
          southConnectorCommand,
          addOrEditGroup,
          deleteGroup
        );
        break;
      case 'edit':
        component.prepareForEdition(
          itemList,
          scanModes,
          [],
          groups,
          itemManifest,
          item,
          southId,
          southConnectorCommand,
          tableIndex,
          addOrEditGroup,
          deleteGroup
        );
        break;
      case 'copy':
        component.prepareForCopy(
          itemList,
          scanModes,
          [],
          groups,
          itemManifest,
          item,
          southId,
          southConnectorCommand,
          addOrEditGroup,
          deleteGroup
        );
        break;
    }
    return tester;
  }

  function savedCommand(): SouthConnectorItemCommandDTO {
    return activeModal.close.mock.lastCall![0];
  }

  test('should populate the form in edit mode', async () => {
    const tester = open('edit');

    await expect.element(tester.title).toHaveTextContent('Edit item');
    await expect.element(tester.name).toHaveValue(savedItem1.name);
    await expect.element(tester.scanMode).toHaveDisplayValue(scanModes[0].name);
    await expect.element(tester.enabled).toBeChecked();
    await expect.element(tester.groupToggle).toHaveTextContent('None');
    await expect.element(tester.syncWithGroup).not.toBeInTheDocument();
  });

  test.each([
    { mode: 'create' as const, title: 'Add a new item to the south connector' },
    { mode: 'edit' as const, title: 'Edit item' }
  ])('should default the historian fields in $mode mode when they are not set', async ({ mode, title }) => {
    const itemWithNullHistorianFields: SouthConnectorItemDTO = {
      ...savedItem1,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null
    };
    const tester = open(mode, { item: itemWithNullHistorianFields });

    await expect.element(tester.title).toHaveTextContent(title);
    await expect.element(tester.maxReadInterval).toHaveValue(3600);
    await expect.element(tester.readDelay).toHaveValue(200);
    await expect.element(tester.startTimeOffset).toHaveValue(0);
    await expect.element(tester.endTimeOffset).toHaveValue(0);
    await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From oldest to newest');
  });

  test('should only offer polling schedules to a polling connector', async () => {
    const tester = open('create');

    await expect.element(tester.scanMode.getByRole('option')).toHaveLength(3);
    await expect.element(tester.scanMode.getByRole('option', { name: 'Subscription' })).not.toBeInTheDocument();
  });

  test('should create an item', async () => {
    const tester = open('create');

    await tester.name.fill('new item');
    await tester.scanMode.selectOptions(scanModes[1].name);
    await tester.enabled.click();
    await tester.maxReadInterval.fill('60');
    await tester.saveButton.click();

    expect(savedCommand()).toEqual(
      expect.objectContaining({
        id: '',
        name: 'new item',
        enabled: false,
        scanModeId: scanModes[1].id,
        scanModeName: scanModes[1].name,
        groupId: null,
        groupName: null,
        syncWithGroup: false,
        maxReadInterval: 60,
        readDelay: 200,
        startTimeOffset: 0,
        endTimeOffset: 0,
        recoveryStrategy: 'oldest',
        cachingStrategy: 'allValues',
        thresholdType: null,
        threshold: null
      })
    );
  });

  test('should save the edited item with its id', async () => {
    const tester = open('edit');

    await tester.name.fill('renamed');
    await tester.saveButton.click();

    expect(savedCommand()).toEqual(expect.objectContaining({ id: savedItem1.id, name: 'renamed', scanModeId: scanModes[0].id }));
  });

  test('should not save an invalid item', async () => {
    const tester = open('create');

    await tester.saveButton.click();

    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should save a subscription item without schedule selection', async () => {
    const tester = open('create', { itemManifest: subscriptionManifest });

    await tester.name.fill('new item');
    await expect.element(tester.scanMode).not.toBeInTheDocument();
    await tester.saveButton.click();

    expect(savedCommand()).toEqual(expect.objectContaining({ scanModeId: 'subscription', scanModeName: '' }));
  });

  test('should prefill a copy of the item, without its id', async () => {
    const tester = open('copy', { itemList: [savedItem1] });

    await expect.element(tester.title).toHaveTextContent('Add a new item to the south connector');
    await expect.element(tester.name).toHaveValue(`${savedItem1.name}-copy`);
    await tester.saveButton.click();

    expect(savedCommand()).toEqual(expect.objectContaining({ id: '', name: `${savedItem1.name}-copy`, scanModeId: scanModes[0].id }));
    expect(testData.south.list[0].items[0].name).toBe('item1');
  });

  describe('groups', () => {
    test('should apply the selected group and sync the item with it', async () => {
      const tester = open('create');
      await tester.name.fill('new item');

      await tester.selectGroup('GroupA');

      await expect.element(tester.groupToggle).toHaveTextContent('GroupA');
      await expect.element(tester.scanMode).not.toBeInTheDocument();
      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toBeDisabled();
      await expect.element(tester.maxReadInterval).toHaveValue(60);
      await expect.element(tester.readDelay).toHaveValue(10);
      await expect.element(tester.startTimeOffset).toHaveValue(500);
      await expect.element(tester.endTimeOffset).toHaveValue(600);
      await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From newest to oldest');

      await tester.saveButton.click();
      // synced with the group: the historian fields are inherited from it
      expect(savedCommand()).toEqual(
        expect.objectContaining({
          groupId: 'group1',
          groupName: 'GroupA',
          syncWithGroup: true,
          scanModeId: scanModes[0].id,
          maxReadInterval: null,
          readDelay: null,
          startTimeOffset: null,
          endTimeOffset: null,
          recoveryStrategy: null,
          cachingStrategy: null
        })
      );
    });

    test('should fall back to the default historian values of a legacy group with null fields', async () => {
      groupA.historySettings = {
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        cachingStrategy: null
      };
      const tester = open('create');

      await tester.selectGroup('GroupA');

      await expect.element(tester.maxReadInterval).toHaveValue(3600);
      await expect.element(tester.readDelay).toHaveValue(200);
      await expect.element(tester.startTimeOffset).toHaveValue(0);
      await expect.element(tester.endTimeOffset).toHaveValue(0);
      await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From oldest to newest');
    });

    test('should keep the item own historian values when it is not synced with its group', async () => {
      const tester = open('create');
      await tester.name.fill('new item');
      await tester.selectGroup('GroupA');

      await tester.syncWithGroup.click();
      await expect.element(tester.maxReadInterval).toBeEnabled();
      await tester.maxReadInterval.fill('120');
      await tester.saveButton.click();

      expect(savedCommand()).toEqual(
        expect.objectContaining({ groupId: 'group1', syncWithGroup: false, maxReadInterval: 120, readDelay: 10 })
      );
    });

    test('should keep sync-with-group on when switching from one group to another', async () => {
      const tester = open('create');
      await tester.selectGroup('GroupA');

      await tester.selectGroup('GroupB');

      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toHaveValue(3600);
    });

    test('should keep sync-with-group off when switching from one group to another, but apply its schedule', async () => {
      const tester = open('create');
      await tester.name.fill('new item');
      await tester.selectGroup('GroupA');
      await tester.syncWithGroup.click();

      await tester.selectGroup('GroupB');

      await expect.element(tester.syncWithGroup).not.toBeChecked();
      await tester.saveButton.click();
      expect(savedCommand()).toEqual(expect.objectContaining({ groupId: 'group2', syncWithGroup: false, scanModeId: scanModes[1].id }));
    });

    test('should turn sync-with-group off and restore the item own fields when the group is deselected', async () => {
      const tester = open('create');
      await tester.selectGroup('GroupA');

      await tester.selectGroup('None');

      await expect.element(tester.groupToggle).toHaveTextContent('None');
      await expect.element(tester.syncWithGroup).not.toBeInTheDocument();
      await expect.element(tester.scanMode).toBeInTheDocument();
      await expect.element(tester.maxReadInterval).toBeEnabled();
    });

    test('should apply the group of an edited item', async () => {
      const item: SouthConnectorItemDTO = { ...savedItem1, group: groupA, syncWithGroup: true };
      const tester = open('edit', { item });

      await expect.element(tester.groupToggle).toHaveTextContent('GroupA');
      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toBeDisabled();
      await expect.element(tester.maxReadInterval).toHaveValue(60);
    });

    test('should create a group, add it to the shared list and select it', async () => {
      const tester = open('create', { directSave: false });
      const command = buildSouthItemGroupCommand(null, 'GroupC');
      const createdGroup = buildSouthItemGroupCommand('group3', 'GroupC', scanModes[1].id);
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'create', group: command });
      addOrEditGroup.mockReturnValue(of(createdGroup));

      await tester.groupToggle.click();
      await tester.createGroupButton.click();

      expect(groupModal.directSave).toBe(false);
      expect(groupModal.prepareForCreation).toHaveBeenCalledWith(
        scanModes.filter(scanMode => scanMode.id !== 'subscription'),
        groups,
        manifest
      );
      expect(addOrEditGroup).toHaveBeenCalledWith({ mode: 'create', group: command });
      expect(groups).toContain(createdGroup);
      await expect.element(tester.groupToggle).toHaveTextContent('GroupC');
      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.okButton).toBeInTheDocument();
    });

    test('should edit the selected group and apply its new values', async () => {
      const tester = open('create');
      await tester.selectGroup('GroupA');
      await tester.syncWithGroup.click();
      await tester.syncWithGroup.click();
      const updatedGroup = buildSouthItemGroup('group1', 'GroupA renamed', scanModes[1]);
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      TestBed.inject(MockModalService).mockClosedModal(groupModal, {
        mode: 'edit',
        group: buildSouthItemGroupCommand('group1', 'GroupA renamed')
      });
      addOrEditGroup.mockReturnValue(of(updatedGroup));

      await tester.groupToggle.click();
      await tester.groupRowButton('GroupA', 'Edit group').click();

      expect(groupModal.prepareForEdition).toHaveBeenCalledWith(expect.any(Array), groups, manifest, groupA);
      expect(groups[0]).toBe(updatedGroup);
      await expect.element(tester.groupToggle).toHaveTextContent('GroupA renamed');
      await expect.element(tester.maxReadInterval).toHaveValue(3600);
      await expect.element(tester.syncWithGroup).toBeChecked();
    });

    test('should delete the selected group, remove it from the shared list and deselect it', async () => {
      const tester = open('create');
      await tester.selectGroup('GroupA');
      deleteGroup.mockReturnValue(of(undefined));

      await tester.groupToggle.click();
      await tester.groupRowButton('GroupA', 'Delete').click();

      expect(deleteGroup).toHaveBeenCalledWith(groupA);
      expect(groups).toEqual([groupB]);
      await expect.element(tester.groupToggle).toHaveTextContent('None');
      await expect.element(tester.groupOption('GroupA')).not.toBeInTheDocument();
      await expect.element(tester.maxReadInterval).toBeEnabled();
      await expect.element(tester.scanMode).toBeInTheDocument();
    });
  });

  describe('caching strategy', () => {
    test('should not be offered to a connector outside the IoT family', async () => {
      const tester = open('create');

      await expect.element(tester.name).toBeInTheDocument();
      await expect.element(tester.cachingStrategy).not.toBeInTheDocument();
    });

    test('should require a threshold for the threshold strategy', async () => {
      const tester = open('create', { itemManifest: opcuaManifest });
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[0].name);

      await tester.cachingStrategy.selectOptions('Threshold');
      await tester.thresholdType.selectOptions('Absolute');
      await tester.saveButton.click();
      expect(activeModal.close).not.toHaveBeenCalled();

      await tester.threshold.fill('5');
      await tester.maxCachingInterval.fill('1000');
      await tester.saveButton.click();
      expect(savedCommand()).toEqual(
        expect.objectContaining({ cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5, maxCachingInterval: 1000 })
      );
    });

    test('should require a range high above the range low for a percentage threshold', async () => {
      const tester = open('create', { itemManifest: opcuaManifest });
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[0].name);
      await tester.cachingStrategy.selectOptions('Threshold');
      await tester.thresholdType.selectOptions('Percentage');
      await tester.threshold.fill('5');

      await tester.rangeLow.fill('10');
      await tester.rangeHigh.fill('10');
      await tester.saveButton.click();
      expect(activeModal.close).not.toHaveBeenCalled();

      await tester.rangeHigh.fill('20');
      await tester.saveButton.click();
      expect(savedCommand()).toEqual(expect.objectContaining({ thresholdType: 'percentage', rangeLow: 10, rangeHigh: 20 }));
    });

    test('should hide the threshold fields for the other strategies', async () => {
      const tester = open('create', { itemManifest: opcuaManifest });

      await tester.cachingStrategy.selectOptions('On change');

      await expect.element(tester.maxCachingInterval).toBeInTheDocument();
      await expect.element(tester.thresholdType).not.toBeInTheDocument();
      await tester.cachingStrategy.selectOptions('All values');
      await expect.element(tester.maxCachingInterval).not.toBeInTheDocument();
    });

    test('should not offer nor accept the threshold strategy for MQTT', async () => {
      const item: SouthConnectorItemDTO = { ...savedItem1, cachingStrategy: 'threshold', threshold: 5, thresholdType: 'absolute' };
      const tester = open('edit', { item, itemManifest: mqttManifest });

      await expect.element(tester.cachingStrategy.getByRole('option', { name: 'Threshold' })).not.toBeInTheDocument();
      await tester.saveButton.click();
      expect(activeModal.close).not.toHaveBeenCalled();

      await tester.cachingStrategy.selectOptions('On change');
      await tester.saveButton.click();
      expect(savedCommand()).toEqual(expect.objectContaining({ cachingStrategy: 'onChange' }));
    });
  });

  describe('name uniqueness', () => {
    const unsavedItem1: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, id: '', name: 'unsaved1' };
    const unsavedItem2: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, id: '', name: 'unsaved2' };
    const itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO> = [savedItem1, savedItem2, unsavedItem1, unsavedItem2];

    async function typeName(tester: EditSouthItemModalComponentTester, name: string) {
      await tester.name.fill(name);
      await userEvent.tab();
    }

    test('create mode should reject the name of any existing item', async () => {
      const tester = open('create', { itemList });

      await typeName(tester, 'brand new');
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, savedItem2.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();

      await typeName(tester, unsavedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('copy mode should reject the name of the copied item', async () => {
      const tester = open('copy', { itemList });

      await typeName(tester, `${savedItem1.name}-copy`);
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, savedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify a saved item by its id rather than its table index', async () => {
      // the table index points to another item: only the id must be used to exclude the edited item
      const tester = open('edit', { item: savedItem2, itemList, tableIndex: 0 });

      await typeName(tester, savedItem2.name);
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, savedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should reject the name of an unsaved item when editing a saved item', async () => {
      const tester = open('edit', { item: savedItem1, itemList, tableIndex: 0 });

      await typeName(tester, unsavedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify an unsaved item by its table index', async () => {
      const tester = open('edit', { item: unsavedItem2, itemList, tableIndex: 3 });

      await typeName(tester, unsavedItem2.name);
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, unsavedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();

      await typeName(tester, savedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });
  });

  test('should dismiss on cancel', async () => {
    const tester = open('create');

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should only ask for confirmation before dismissing when there are unsaved changes', async () => {
    const tester = open('edit');
    await expect.element(tester.name).toHaveValue(savedItem1.name);
    expect(tester.fixture.componentInstance.canDismiss()).toBe(true);

    const confirmation = of(true);
    unsavedChangesService.confirmUnsavedChanges.mockReturnValue(confirmation);
    await tester.name.fill('changed');

    expect(tester.fixture.componentInstance.canDismiss()).toBe(confirmation);
  });
});
