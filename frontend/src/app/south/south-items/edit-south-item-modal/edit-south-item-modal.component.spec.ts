import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthItemGroupDTO,
  SouthItemNorthTransformerCommandDTO
} from '@oibus/shared/api/south-connector.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildSouthItemGroup, buildSouthItemGroupCommand } from '../../../../test/builders';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { ITEM_MODAL_STEPS, ItemModalStep } from '../item-modal-steps';
import { FakeSouthItemGroups, fakeSouthItemGroups } from '../south-item-groups.testing';
import EditSouthItemModalComponent from './edit-south-item-modal.component';

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
// North 2 gets no data of the south: a transformer is attached to it in the North step
const northTransformer: SouthItemNorthTransformerCommandDTO = {
  northId: 'northId2',
  scope: 'item',
  transformerId: 'transformerId2',
  options: {}
};

class EditSouthItemModalComponentTester {
  readonly fixture = TestBed.createComponent(EditSouthItemModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly name = this.root.getByLabelText('Name', { exact: true });
  readonly groupToggle = this.root.getByRole('button', { name: 'Group', exact: true });
  readonly scanMode = this.root.getByLabelText('Schedule');
  readonly enabled = this.root.getByLabelText('Enabled');
  /** The Disabled choice of the status, by its label: its radio button is hidden behind it */
  readonly disable = this.root.getByCss('label[for="item-enabled-disabled"]');
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
  readonly saveButton = this.root.getByRole('button', { name: 'Save', exact: true });
  readonly okButton = this.root.getByRole('button', { name: 'OK', exact: true });
  readonly saveAndAddAnotherButton = this.root.getByRole('button', { name: 'Save & add another' });
  readonly okAndAddAnotherButton = this.root.getByRole('button', { name: 'OK & add another' });
  readonly cancelButton = this.root.getByCss('.modal-footer').getByRole('button', { name: 'Cancel' });
  readonly createGroupButton = this.root.getByRole('button', { name: 'Create a new group...' });
  readonly mustBeUnique = this.root.getByText('Must be unique');
  readonly nextButton = this.root.getByRole('button', { name: 'Next' });
  readonly backButton = this.root.getByRole('button', { name: 'Back' });
  readonly groupScanMode = this.root.getByCss('#group-scan-mode');
  readonly summary = this.root.getByCss('#item-summary');

  readonly reviewErrors = this.root.getByCss('#review-errors');
  readonly reviewChanges = this.root.getByCss('#review-changes');

  /** A setting in the Review step, by its label */
  reviewedEntry(label: string) {
    return this.root.getByCss('#step-review .oib-summary-entry').filter({ has: page.getByText(label, { exact: true }) });
  }

  /** The value of a setting in the Review step, by its label */
  reviewed(label: string) {
    return this.reviewedEntry(label).getByRole('definition');
  }
  readonly runTestButton = this.root.getByCss('#step-settings-test #test-item');
  readonly northTransformersSummary = this.root.getByCss('#north-transformers-summary');

  /** Attaches "my transformer 2" to a North, in the North step */
  async attachTransformer(northName: string, scope = 'This item') {
    await this.step('north').click();
    await this.root.getByRole('listitem').filter({ hasText: northName }).click();
    await this.root.getByRole('button', { name: 'Attach a transformer' }).click();
    await this.root.getByRole('radio', { name: scope }).click();
    await this.root.getByRole('radio', { name: /^my transformer 2/ }).click();
    await this.root.getByRole('button', { name: 'Attach', exact: true }).click();
  }

  step(step: ItemModalStep) {
    return this.root.getByCss(`#modal-step-${step}`);
  }

  /** Saves from the last step, where a new item is saved */
  async save() {
    await this.step('review').click();
    await this.saveButton.click();
  }

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
  let groupA: SouthItemGroupDTO;
  let groupB: SouthItemGroupDTO;
  let groups: FakeSouthItemGroups;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    unsavedChangesService = createMock(UnsavedChangesConfirmationService);
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
    groups = fakeSouthItemGroups([groupA, groupB]);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) },
        {
          provide: NorthConnectorService,
          useValue: createMock(NorthConnectorService, {
            list: () => of(testData.north.listLight),
            findById: (northId: string) => of(testData.north.list.find(north => north.id === northId)!),
            getNorthManifest: (type: OIBusNorthType) => of({ ...testData.north.manifest, id: type })
          })
        },
        { provide: TransformerService, useValue: createMock(TransformerService, { list: () => of(testData.transformers.customList) }) },
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
    previousItem?: SouthConnectorItemCommandDTO;
    /** The step to open: the name & schedule one by default, where most of the item is edited */
    step?: ItemModalStep;
  }

  /** Opens the modal like its openers do: for creation, or for edition / copy of `item`, on the given step. */
  async function open(mode: 'create' | 'edit' | 'copy', options: OpenOptions = {}) {
    const {
      item = savedItem1,
      itemList = [],
      itemManifest = manifest,
      tableIndex = 0,
      directSave = true,
      previousItem = null,
      step = 'general'
    } = options;
    const tester = new EditSouthItemModalComponentTester();
    const component = tester.fixture.componentInstance;
    component.directSave = directSave;
    switch (mode) {
      case 'create':
        component.prepareForCreation(itemList, scanModes, [], groups, itemManifest, southId, southConnectorCommand, previousItem);
        break;
      case 'edit':
        component.prepareForEdition(itemList, scanModes, [], groups, itemManifest, item, southId, southConnectorCommand, tableIndex);
        break;
      case 'copy':
        component.prepareForCopy(itemList, scanModes, [], groups, itemManifest, item, southId, southConnectorCommand);
        break;
    }
    if (step !== ITEM_MODAL_STEPS[0]) {
      await tester.step(step).click();
    }
    return tester;
  }

  function savedCommand(): SouthConnectorItemCommandDTO {
    return activeModal.close.mock.lastCall![0];
  }

  test('should populate the form in edit mode', async () => {
    const tester = await open('edit');

    await expect.element(tester.title).toHaveTextContent('Edit item');
    await expect.element(tester.root.getByRole('heading', { level: 5, name: 'Name & schedule' })).toBeInTheDocument();
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
    const tester = await open(mode, { item: itemWithNullHistorianFields });

    await expect.element(tester.title).toHaveTextContent(title);
    await expect.element(tester.maxReadInterval).toHaveValue(3600);
    await expect.element(tester.readDelay).toHaveValue(200);
    await expect.element(tester.startTimeOffset).toHaveValue(0);
    await expect.element(tester.endTimeOffset).toHaveValue(0);
    await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From oldest to newest');
  });

  test('should only offer polling schedules to a polling connector', async () => {
    const tester = await open('create');

    await expect.element(tester.scanMode.getByRole('option')).toHaveLength(3);
    await expect.element(tester.scanMode.getByRole('option', { name: 'Subscription' })).not.toBeInTheDocument();
  });

  test('should create an item', async () => {
    const tester = await open('create');

    await tester.name.fill('new item');
    await tester.scanMode.selectOptions(scanModes[1].name);
    await tester.disable.click();
    await tester.maxReadInterval.fill('60');
    await tester.save();

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
    const tester = await open('edit');

    await tester.name.fill('renamed');
    await tester.saveButton.click();

    expect(savedCommand()).toEqual(expect.objectContaining({ id: savedItem1.id, name: 'renamed', scanModeId: scanModes[0].id }));
  });

  test('should not save an invalid item, and show the step to fix', async () => {
    const tester = await open('create');

    await tester.save();

    expect(activeModal.close).not.toHaveBeenCalled();
    await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
    await expect.element(tester.step('general')).toHaveClass('modal-step-invalid');
    await expect.element(tester.step('settings')).not.toHaveClass('modal-step-invalid');

    await tester.name.fill('new item');
    await tester.scanMode.selectOptions(scanModes[0].name);
    await expect.element(tester.step('general')).not.toHaveClass('modal-step-invalid');
  });

  describe('steps', () => {
    test('should open the next step when pressing Enter in a field of a new item', async () => {
      const tester = await open('create');
      await tester.scanMode.selectOptions(scanModes[0].name);

      // not from a radio button, nor before the step is valid
      await tester.disable.click();
      await userEvent.keyboard('{Enter}');
      await tester.name.click();
      await userEvent.keyboard('{Enter}');
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');

      await tester.name.fill('new item');
      await userEvent.keyboard('{Enter}');

      await expect.element(tester.step('north')).toHaveAttribute('aria-current', 'step');
      expect(activeModal.close).not.toHaveBeenCalled();
    });

    test('should save an edited item once when pressing Enter in a field', async () => {
      const tester = await open('edit');

      await tester.name.fill('renamed');
      await userEvent.keyboard('{Enter}');

      expect(activeModal.close).toHaveBeenCalledTimes(1);
      expect(savedCommand()).toEqual(expect.objectContaining({ name: 'renamed' }));
    });

    test('should only open the next step once the current one is valid', async () => {
      const tester = await open('create', { step: 'settings' });
      // the settings come first, tested right where they are edited
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.runTestButton).toBeVisible();
      await expect.element(tester.saveButton).not.toBeInTheDocument();
      await expect.element(tester.backButton).not.toBeInTheDocument();

      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.runTestButton).not.toBeVisible();
      await tester.nextButton.click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.step('general')).toHaveClass('modal-step-invalid');
      await expect.element(tester.root.getByText('This field is required').first()).toBeInTheDocument();

      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[0].name);
      await tester.nextButton.click();
      // where the data of the item goes, once its group is chosen
      await expect.element(tester.step('north')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.root.getByRole('listitem')).toHaveLength(2);
      await tester.nextButton.click();
      await expect.element(tester.step('review')).toHaveAttribute('aria-current', 'step');
      await expect.element(tester.nextButton).not.toBeInTheDocument();
      await expect.element(tester.saveButton).toBeInTheDocument();

      await tester.backButton.click();
      await expect.element(tester.step('north')).toHaveAttribute('aria-current', 'step');
    });

    test('should save an edited item from any step', async () => {
      const tester = await open('edit');

      await expect.element(tester.saveButton).toBeInTheDocument();
      await tester.step('settings').click();
      await tester.saveButton.click();

      expect(savedCommand()).toEqual(expect.objectContaining({ id: savedItem1.id }));
    });

    test('should sum the item up on the last step', async () => {
      const item: SouthConnectorItemDTO = { ...savedItem1, group: groupA, syncWithGroup: true, enabled: false };
      const tester = await open('edit', { item });

      await tester.step('review').click();

      const values = tester.summary.getByRole('definition');
      await expect.element(values.nth(0)).toHaveTextContent(savedItem1.name);
      await expect.element(values.nth(1)).toHaveTextContent('Disabled');
      await expect.element(values.nth(2)).toHaveTextContent('GroupA');
      await expect.element(values.nth(3)).toHaveTextContent(scanModes[0].name);
      // the history settings that apply: the group's ones, since the item is synced with it
      await expect.element(tester.reviewed('Sync with group')).toHaveTextContent('Yes');
      await expect.element(tester.reviewed('Max read interval')).toHaveTextContent('60 s');
      await expect.element(tester.reviewed('Recovery strategy')).toHaveTextContent('From newest to oldest');
      // the connector specific settings
      await expect.element(tester.root.getByCss('#settings-summary')).toBeInTheDocument();
    });

    test('should sum the caching strategy up for an IoT connector', async () => {
      const item: SouthConnectorItemDTO = { ...savedItem1, cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 };
      const tester = await open('edit', { item, itemManifest: opcuaManifest });

      await tester.step('review').click();

      await expect.element(tester.reviewed('Caching strategy')).toHaveTextContent('Threshold');
      await expect.element(tester.reviewed('Threshold type')).toHaveTextContent('Absolute');
    });

    test('should show what changed since the edited item was saved', async () => {
      const tester = await open('edit');
      await tester.step('review').click();
      await expect.element(tester.reviewChanges).toHaveTextContent('No change since the item was saved');

      await tester.step('general').click();
      await tester.name.fill('renamed');
      await tester.maxReadInterval.fill('60');
      await tester.step('review').click();

      await expect.element(tester.reviewChanges).toHaveTextContent('Settings changed since the item was saved: 2');
      await expect.element(tester.reviewedEntry('Name')).toHaveClass('oib-summary-changed');
      await expect.element(tester.reviewed('Name')).toHaveTextContent(`renamed Was ${savedItem1.name}`);
      await expect.element(tester.reviewed('Max read interval')).toHaveTextContent('60 s Was 3600 s');
      await expect.element(tester.reviewedEntry('Read delay')).not.toHaveClass('oib-summary-changed');
    });

    test('should not compare a new item with anything', async () => {
      const tester = await open('copy', { itemList: [] });

      await tester.step('review').click();

      await expect.element(tester.reviewed('Name')).toHaveTextContent(`${savedItem1.name}-copy`);
      await expect.element(tester.reviewChanges).not.toBeInTheDocument();
      await expect.element(tester.reviewedEntry('Name')).not.toHaveClass('oib-summary-changed');
    });

    test('should list the steps to fix, and open them', async () => {
      const tester = await open('create');

      await tester.step('review').click();

      await expect.element(tester.reviewErrors.getByText('Fix these steps before saving:')).toBeInTheDocument();
      await expect.element(tester.reviewedEntry('Name')).toHaveClass('oib-summary-invalid');
      await tester.reviewErrors.getByRole('button', { name: 'Name & schedule' }).click();
      await expect.element(tester.step('general')).toHaveAttribute('aria-current', 'step');
    });
  });

  test('should save a subscription item without schedule selection', async () => {
    const tester = await open('create', { itemManifest: subscriptionManifest });

    await tester.name.fill('new item');
    await expect.element(tester.scanMode).not.toBeInTheDocument();
    await tester.save();

    expect(savedCommand()).toEqual(expect.objectContaining({ scanModeId: 'subscription', scanModeName: '' }));
  });

  test('should prefill a copy of the item, without its id', async () => {
    const tester = await open('copy', { itemList: [savedItem1] });

    await expect.element(tester.title).toHaveTextContent('Add a new item to the south connector');
    await expect.element(tester.name).toHaveValue(`${savedItem1.name}-copy`);
    await tester.saveButton.click();

    expect(savedCommand()).toEqual(expect.objectContaining({ id: '', name: `${savedItem1.name}-copy`, scanModeId: scanModes[0].id }));
    expect(testData.south.list[0].items[0].name).toBe('item1');
  });

  describe('groups', () => {
    test('should apply the selected group and sync the item with it', async () => {
      const tester = await open('create');
      await tester.name.fill('new item');

      await tester.selectGroup('GroupA');

      await expect.element(tester.groupToggle).toHaveTextContent('GroupA');
      await expect.element(tester.scanMode).not.toBeInTheDocument();
      await expect.element(tester.groupScanMode).toHaveTextContent(`Schedule ${scanModes[0].name} (from the group)`);
      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toBeDisabled();
      await expect.element(tester.maxReadInterval).toHaveValue(60);
      await expect.element(tester.readDelay).toHaveValue(10);
      await expect.element(tester.startTimeOffset).toHaveValue(500);
      await expect.element(tester.endTimeOffset).toHaveValue(600);
      await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From newest to oldest');

      await tester.save();
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
      const tester = await open('create');

      await tester.selectGroup('GroupA');

      await expect.element(tester.maxReadInterval).toHaveValue(3600);
      await expect.element(tester.readDelay).toHaveValue(200);
      await expect.element(tester.startTimeOffset).toHaveValue(0);
      await expect.element(tester.endTimeOffset).toHaveValue(0);
      await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From oldest to newest');
    });

    test('should keep the item own historian values when it is not synced with its group', async () => {
      const tester = await open('create');
      await tester.name.fill('new item');
      await tester.selectGroup('GroupA');

      await tester.syncWithGroup.click();
      await expect.element(tester.maxReadInterval).toBeEnabled();
      await tester.maxReadInterval.fill('120');
      await tester.save();

      expect(savedCommand()).toEqual(
        expect.objectContaining({ groupId: 'group1', syncWithGroup: false, maxReadInterval: 120, readDelay: 10 })
      );
    });

    test('should keep sync-with-group on when switching from one group to another', async () => {
      const tester = await open('create');
      await tester.selectGroup('GroupA');

      await tester.selectGroup('GroupB');

      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toHaveValue(3600);
    });

    test('should keep sync-with-group off when switching from one group to another, but apply its schedule', async () => {
      const tester = await open('create');
      await tester.name.fill('new item');
      await tester.selectGroup('GroupA');
      await tester.syncWithGroup.click();

      await tester.selectGroup('GroupB');

      await expect.element(tester.syncWithGroup).not.toBeChecked();
      await tester.save();
      expect(savedCommand()).toEqual(expect.objectContaining({ groupId: 'group2', syncWithGroup: false, scanModeId: scanModes[1].id }));
    });

    test('should turn sync-with-group off and restore the item own fields when the group is deselected', async () => {
      const tester = await open('create');
      await tester.selectGroup('GroupA');

      await tester.selectGroup('None');

      await expect.element(tester.groupToggle).toHaveTextContent('None');
      await expect.element(tester.syncWithGroup).not.toBeInTheDocument();
      await expect.element(tester.scanMode).toBeInTheDocument();
      await expect.element(tester.maxReadInterval).toBeEnabled();
    });

    test('should apply the group of an edited item', async () => {
      const item: SouthConnectorItemDTO = { ...savedItem1, group: groupA, syncWithGroup: true };
      const tester = await open('edit', { item });

      await expect.element(tester.groupToggle).toHaveTextContent('GroupA');
      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toBeDisabled();
      await expect.element(tester.maxReadInterval).toHaveValue(60);
    });

    test('should create a group through the groups of the page and select it', async () => {
      const tester = await open('create', { directSave: false });
      const command = buildSouthItemGroupCommand(null, 'GroupC', scanModes[1].id);
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'create', group: command });
      const listedGroups = groups.list();

      await tester.groupToggle.click();
      await tester.createGroupButton.click();

      expect(groupModal.directSave).toBe(false);
      expect(groupModal.prepareForCreation).toHaveBeenCalledWith(
        scanModes.filter(scanMode => scanMode.id !== 'subscription'),
        listedGroups,
        manifest
      );
      expect(groups.save).toHaveBeenCalledWith({ mode: 'create', group: command });
      await expect.element(tester.groupToggle).toHaveTextContent('GroupC');
      await expect.element(tester.syncWithGroup).toBeChecked();
      await tester.step('review').click();
      await expect.element(tester.okButton).toBeInTheDocument();
    });

    test('should edit the selected group and apply its new values', async () => {
      const tester = await open('create');
      await tester.selectGroup('GroupA');
      await tester.syncWithGroup.click();
      await tester.syncWithGroup.click();
      const command = buildSouthItemGroupCommand('group1', 'GroupA renamed', scanModes[1].id);
      const groupModal = createMock(EditSouthItemGroupModalComponent);
      TestBed.inject(MockModalService).mockClosedModal(groupModal, { mode: 'edit', group: command });
      const listedGroups = groups.list();

      await tester.groupToggle.click();
      await tester.groupRowButton('GroupA', 'Edit group').click();

      expect(groupModal.prepareForEdition).toHaveBeenCalledWith(expect.any(Array), listedGroups, manifest, groupA);
      expect(groups.save).toHaveBeenCalledWith({ mode: 'edit', group: command });
      await expect.element(tester.groupToggle).toHaveTextContent('GroupA renamed');
      await expect.element(tester.maxReadInterval).toHaveValue(3600);
      await expect.element(tester.syncWithGroup).toBeChecked();
    });

    test('should delete the selected group through the groups of the page and deselect it', async () => {
      const tester = await open('create');
      await tester.selectGroup('GroupA');

      await tester.groupToggle.click();
      await tester.groupRowButton('GroupA', 'Delete').click();

      expect(groups.delete).toHaveBeenCalledWith(groupA);
      await expect.element(tester.groupToggle).toHaveTextContent('None');
      await expect.element(tester.groupOption('GroupA')).not.toBeInTheDocument();
      await expect.element(tester.maxReadInterval).toBeEnabled();
      await expect.element(tester.scanMode).toBeInTheDocument();
    });
  });

  describe('caching strategy', () => {
    test('should not be offered to a connector outside the IoT family', async () => {
      const tester = await open('create');

      await expect.element(tester.name).toBeInTheDocument();
      await expect.element(tester.cachingStrategy).not.toBeInTheDocument();
    });

    test('should require a threshold for the threshold strategy', async () => {
      const tester = await open('create', { itemManifest: opcuaManifest });
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[0].name);

      await tester.cachingStrategy.selectOptions('Threshold');
      await tester.thresholdType.selectOptions('Absolute');
      await tester.save();
      expect(activeModal.close).not.toHaveBeenCalled();

      await tester.threshold.fill('5');
      await tester.maxCachingInterval.fill('1000');
      await tester.save();
      expect(savedCommand()).toEqual(
        expect.objectContaining({ cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5, maxCachingInterval: 1000 })
      );
    });

    test('should require a range high above the range low for a percentage threshold', async () => {
      const tester = await open('create', { itemManifest: opcuaManifest });
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[0].name);
      await tester.cachingStrategy.selectOptions('Threshold');
      await tester.thresholdType.selectOptions('Percentage');
      await tester.threshold.fill('5');

      await tester.rangeLow.fill('10');
      await tester.rangeHigh.fill('10');
      await tester.save();
      expect(activeModal.close).not.toHaveBeenCalled();

      await tester.rangeHigh.fill('20');
      await tester.save();
      expect(savedCommand()).toEqual(expect.objectContaining({ thresholdType: 'percentage', rangeLow: 10, rangeHigh: 20 }));
    });

    test('should hide the threshold fields for the other strategies', async () => {
      const tester = await open('create', { itemManifest: opcuaManifest });

      await tester.cachingStrategy.selectOptions('On change');

      await expect.element(tester.maxCachingInterval).toBeInTheDocument();
      await expect.element(tester.thresholdType).not.toBeInTheDocument();
      await tester.cachingStrategy.selectOptions('All values');
      await expect.element(tester.maxCachingInterval).not.toBeInTheDocument();
    });

    test('should not offer nor accept the threshold strategy for MQTT', async () => {
      const item: SouthConnectorItemDTO = { ...savedItem1, cachingStrategy: 'threshold', threshold: 5, thresholdType: 'absolute' };
      const tester = await open('edit', { item, itemManifest: mqttManifest });

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
      const tester = await open('create', { itemList });

      await typeName(tester, 'brand new');
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, savedItem2.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();

      await typeName(tester, unsavedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('copy mode should reject the name of the copied item', async () => {
      const tester = await open('copy', { itemList });

      await typeName(tester, `${savedItem1.name}-copy`);
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, savedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify a saved item by its id rather than its table index', async () => {
      // the table index points to another item: only the id must be used to exclude the edited item
      const tester = await open('edit', { item: savedItem2, itemList, tableIndex: 0 });

      await typeName(tester, savedItem2.name);
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, savedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should reject the name of an unsaved item when editing a saved item', async () => {
      const tester = await open('edit', { item: savedItem1, itemList, tableIndex: 0 });

      await typeName(tester, unsavedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify an unsaved item by its table index', async () => {
      const tester = await open('edit', { item: unsavedItem2, itemList, tableIndex: 3 });

      await typeName(tester, unsavedItem2.name);
      await expect.element(tester.mustBeUnique).not.toBeInTheDocument();

      await typeName(tester, unsavedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();

      await typeName(tester, savedItem1.name);
      await expect.element(tester.mustBeUnique).toBeInTheDocument();
    });
  });

  describe('save and add another', () => {
    test('should only be offered on the last step of a new item', async () => {
      const tester = await open('create');
      await expect.element(tester.nextButton).toBeInTheDocument();
      await expect.element(tester.saveAndAddAnotherButton).not.toBeInTheDocument();

      await tester.step('review').click();

      await expect.element(tester.saveAndAddAnotherButton).toBeInTheDocument();
    });

    test.each(['edit' as const, 'copy' as const])('should not be offered in %s mode', async mode => {
      const tester = await open(mode);
      await tester.step('review').click();

      await expect.element(tester.saveButton).toBeInTheDocument();
      await expect.element(tester.saveAndAddAnotherButton).not.toBeInTheDocument();
    });

    test('should save the new item and ask for another one', async () => {
      const tester = await open('create');
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[1].name);
      await tester.step('review').click();

      await tester.saveAndAddAnotherButton.click();

      expect(savedCommand()).toEqual(expect.objectContaining({ id: '', name: 'new item', scanModeId: scanModes[1].id }));
      expect(tester.fixture.componentInstance.addAnother).toBe(true);
    });

    test('should not ask for another item when saved with the main action', async () => {
      const tester = await open('create');
      await tester.scanMode.selectOptions(scanModes[1].name);
      // an invalid attempt first, without a name: the main action must not reuse it
      await tester.step('review').click();
      await tester.saveAndAddAnotherButton.click();
      expect(activeModal.close).not.toHaveBeenCalled();

      await tester.name.fill('new item');
      await tester.save();

      expect(savedCommand()).toEqual(expect.objectContaining({ name: 'new item' }));
      expect(tester.fixture.componentInstance.addAnother).toBe(false);
    });

    test('should be worded like the main action when the item is added in memory', async () => {
      const tester = await open('create', { directSave: false });
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[1].name);
      await tester.step('review').click();
      await expect.element(tester.okButton).toBeInTheDocument();

      await tester.okAndAddAnotherButton.click();

      expect(tester.fixture.componentInstance.addAnother).toBe(true);
    });

    test('should start the next item with the schedule and history settings of the previous one', async () => {
      const previousItem: SouthConnectorItemCommandDTO = {
        ...testData.south.itemCommand,
        name: 'previous item',
        enabled: false,
        scanModeId: scanModes[1].id,
        maxReadInterval: 120,
        readDelay: 50,
        startTimeOffset: 10,
        endTimeOffset: 20,
        recoveryStrategy: 'newest',
        cachingStrategy: 'onChange',
        maxCachingInterval: 1000
      };
      const tester = await open('create', { itemManifest: opcuaManifest, previousItem, itemList: [previousItem], step: 'settings' });

      // a fresh item, from the first step
      await expect.element(tester.step('settings')).toHaveAttribute('aria-current', 'step');
      await tester.step('general').click();
      await expect.element(tester.name).toHaveValue('');
      await expect.element(tester.scanMode).toHaveDisplayValue(scanModes[1].name);
      await expect.element(tester.enabled).not.toBeChecked();
      await expect.element(tester.maxReadInterval).toHaveValue(120);
      await expect.element(tester.readDelay).toHaveValue(50);
      await expect.element(tester.startTimeOffset).toHaveValue(10);
      await expect.element(tester.endTimeOffset).toHaveValue(20);
      await expect.element(tester.recoveryStrategy).toHaveDisplayValue('From newest to oldest');
      await expect.element(tester.cachingStrategy).toHaveDisplayValue('On change');
      await expect.element(tester.maxCachingInterval).toHaveValue(1000);
      // nothing typed yet: no confirmation before dismissing
      expect(tester.fixture.componentInstance.canDismiss()).toBe(true);

      // the name of the item just added is taken
      await tester.name.fill(previousItem.name);
      await userEvent.tab();
      await expect.element(tester.mustBeUnique).toBeInTheDocument();

      await tester.name.fill('next item');
      await tester.save();
      // its connector settings, which tell it apart from the previous one, start from their defaults
      expect(savedCommand()).toEqual(
        expect.objectContaining({
          id: '',
          name: 'next item',
          enabled: false,
          scanModeId: scanModes[1].id,
          maxReadInterval: 120,
          cachingStrategy: 'onChange',
          maxCachingInterval: 1000,
          settings: expect.objectContaining({ objectValue: 1 })
        })
      );
    });

    test('should start the next item in the group of the previous one', async () => {
      const previousItem: SouthConnectorItemCommandDTO = {
        ...testData.south.itemCommand,
        groupId: groupA.id,
        groupName: groupA.standardSettings.name,
        syncWithGroup: true,
        scanModeId: scanModes[0].id,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null
      };
      const tester = await open('create', { previousItem });

      await expect.element(tester.groupToggle).toHaveTextContent('GroupA');
      await expect.element(tester.groupScanMode).toHaveTextContent(`Schedule ${scanModes[0].name} (from the group)`);
      await expect.element(tester.syncWithGroup).toBeChecked();
      await expect.element(tester.maxReadInterval).toBeDisabled();
      await expect.element(tester.maxReadInterval).toHaveValue(60);

      await tester.name.fill('next item');
      await tester.save();
      expect(savedCommand()).toEqual(
        expect.objectContaining({ groupId: 'group1', syncWithGroup: true, scanModeId: scanModes[0].id, maxReadInterval: null })
      );
    });
  });

  describe('north transformers', () => {
    test('should save the transformers attached in the North step with the item', async () => {
      const tester = await open('create');
      await tester.name.fill('new item');
      await tester.scanMode.selectOptions(scanModes[0].name);

      await tester.attachTransformer('North 2');
      await tester.step('review').click();

      await expect.element(tester.northTransformersSummary).toMatchTextContent(/North 2\s*my transformer 2 · this item/);
      await tester.saveButton.click();
      expect(savedCommand()).toEqual(expect.objectContaining({ name: 'new item', northTransformers: [northTransformer] }));
    });

    test('should count the transformers attached as changes of an edited item', async () => {
      const tester = await open('edit');

      await tester.attachTransformer('North 2');
      await tester.step('review').click();

      await expect.element(tester.reviewChanges).toHaveTextContent('Settings changed since the item was saved: 1');
    });

    test('should ask for confirmation before dismissing once a transformer is attached', async () => {
      const tester = await open('edit');
      const confirmation = of(true);
      unsavedChangesService.confirmUnsavedChanges.mockReturnValue(confirmation);

      await tester.attachTransformer('North 2');

      expect(tester.fixture.componentInstance.canDismiss()).toBe(confirmation);
    });

    test('should keep the transformers attached before to an item edited in memory, but not to its copy', async () => {
      const inMemoryItem: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, northTransformers: [northTransformer] };

      const tester = await open('edit', { item: inMemoryItem, directSave: false });
      await tester.okButton.click();
      expect(savedCommand().northTransformers).toEqual([northTransformer]);

      const copyTester = await open('copy', { item: inMemoryItem, directSave: false });
      await copyTester.okButton.click();
      expect(savedCommand().northTransformers).toEqual([]);
    });

    test('should drop the transformers attached to the group once the item leaves it', async () => {
      const tester = await open('create');
      await tester.name.fill('new item');
      await tester.selectGroup('GroupA');
      await tester.attachTransformer('North 2', 'Its group (GroupA)');

      await tester.step('general').click();
      await tester.selectGroup('None');
      await tester.save();

      expect(savedCommand().northTransformers).toEqual([]);
    });
  });

  test('should dismiss on cancel', async () => {
    const tester = await open('create');

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should only ask for confirmation before dismissing when there are unsaved changes', async () => {
    const tester = await open('edit');
    await expect.element(tester.name).toHaveValue(savedItem1.name);
    expect(tester.fixture.componentInstance.canDismiss()).toBe(true);

    const confirmation = of(true);
    unsavedChangesService.confirmUnsavedChanges.mockReturnValue(confirmation);
    await tester.name.fill('changed');

    expect(tester.fixture.componentInstance.canDismiss()).toBe(confirmation);
  });
});
