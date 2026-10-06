import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorItemCommandDTO, SouthConnectorItemDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { ModalService } from '../../../shared/modal.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import EditSouthItemModalComponent from './edit-south-item-modal.component';

const manifest = testData.south.manifest;
const southConnectorCommand = testData.south.command;
const scanModes = testData.scanMode.list;
const southId = testData.south.list[0].id;
const existingItem = testData.south.list[0].items[0];
const groups: Array<SouthItemGroupDTO> = [];
const noop = () => of({} as any);

const buildGroup = (id: string, name: string, scanMode: ScanModeDTO): SouthItemGroupDTO => ({
  id,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: { name, scanMode },
  historySettings: {
    startTimeOffset: 0,
    endTimeOffset: 0,
    maxReadInterval: 3600,
    readDelay: 200,
    recoveryStrategy: 'oldest',
    cachingStrategy: null
  }
});

describe('EditSouthItemModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);
    const modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should populate form in edit mode', async () => {
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForEdition(
      [existingItem],
      scanModes,
      [] as Array<CertificateDTO>,
      groups,
      manifest,
      existingItem,
      southId,
      southConnectorCommand as any,
      0,
      noop,
      noop
    );
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#name')).toHaveValue(existingItem.name);
  });

  test('should render create mode', async () => {
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      groups,
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#name')).toBeInTheDocument();
  });

  test('create mode should default historian fields to sensible values', () => {
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      groups,
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    const controls = fixture.componentInstance.form!.controls;
    expect(controls.maxReadInterval.value).toBe(3600);
    expect(controls.readDelay.value).toBe(200);
    expect(controls.startTimeOffset.value).toBe(0);
    expect(controls.endTimeOffset.value).toBe(0);
    expect(controls.recoveryStrategy.value).toBe('oldest');
  });

  test('edit mode should fall back to the same historian defaults when the item field is null', () => {
    const itemWithNullHistorianFields = {
      ...existingItem,
      group: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null
    };
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForEdition(
      [itemWithNullHistorianFields],
      scanModes,
      [] as Array<CertificateDTO>,
      groups,
      manifest,
      itemWithNullHistorianFields,
      southId,
      southConnectorCommand as any,
      0,
      noop,
      noop
    );
    fixture.detectChanges();

    const controls = fixture.componentInstance.form!.controls;
    expect(controls.maxReadInterval.value).toBe(3600);
    expect(controls.readDelay.value).toBe(200);
    expect(controls.startTimeOffset.value).toBe(0);
    expect(controls.endTimeOffset.value).toBe(0);
    expect(controls.recoveryStrategy.value).toBe('oldest');
  });

  test('selecting a group should copy its historian offsets', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    groupA.historySettings.startTimeOffset = 500;
    groupA.historySettings.endTimeOffset = 600;
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      [groupA],
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');

    expect(fixture.componentInstance.form!.controls.startTimeOffset.value).toBe(500);
    expect(fixture.componentInstance.form!.controls.endTimeOffset.value).toBe(600);
  });

  test('selecting a legacy group with null historian fields should fall back to sensible defaults', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    groupA.historySettings = {
      startTimeOffset: null,
      endTimeOffset: null,
      maxReadInterval: null,
      readDelay: null,
      recoveryStrategy: null,
      cachingStrategy: null
    };
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      [groupA],
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');

    const controls = fixture.componentInstance.form!.controls;
    expect(controls.maxReadInterval.value).toBe(3600);
    expect(controls.readDelay.value).toBe(200);
    expect(controls.startTimeOffset.value).toBe(0);
    expect(controls.endTimeOffset.value).toBe(0);
    expect(controls.recoveryStrategy.value).toBe('oldest');
  });

  test('selecting a group from none should turn sync-with-group on', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      [groupA],
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');

    expect(fixture.componentInstance.form!.controls.syncWithGroup.value).toBe(true);
  });

  test('switching from one group to another should keep sync-with-group enabled', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const groupB = buildGroup('group2', 'GroupB', scanModes[1]);
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      [groupA, groupB],
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');
    expect(fixture.componentInstance.form!.controls.syncWithGroup.value).toBe(true);

    fixture.componentInstance.onSelectGroup('group2');
    expect(fixture.componentInstance.form!.controls.syncWithGroup.value).toBe(true);
  });

  test('switching from one group to another should keep sync-with-group disabled', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const groupB = buildGroup('group2', 'GroupB', scanModes[1]);
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      [groupA, groupB],
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');
    fixture.componentInstance.form!.controls.syncWithGroup.setValue(false);
    fixture.componentInstance.onSyncWithGroupChange();

    fixture.componentInstance.onSelectGroup('group2');

    expect(fixture.componentInstance.form!.controls.syncWithGroup.value).toBe(false);
    expect(fixture.componentInstance.form!.controls.scanModeId.value).toBe(scanModes[1].id);
  });

  test('deselecting a group should turn sync-with-group off', () => {
    const groupA = buildGroup('group1', 'GroupA', scanModes[0]);
    const fixture = TestBed.createComponent(EditSouthItemModalComponent);
    fixture.componentInstance.prepareForCreation(
      [],
      scanModes,
      [] as Array<CertificateDTO>,
      [groupA],
      manifest,
      southId,
      southConnectorCommand as any,
      noop,
      noop
    );
    fixture.detectChanges();

    fixture.componentInstance.onSelectGroup('group1');
    fixture.componentInstance.onSelectGroup(null);

    expect(fixture.componentInstance.form!.controls.syncWithGroup.value).toBe(false);
  });
  describe('name uniqueness', () => {
    const [savedItem1, savedItem2] = testData.south.list[0].items;
    const unsavedItem1: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, id: '', name: 'unsaved1' };
    const unsavedItem2: SouthConnectorItemCommandDTO = { ...testData.south.itemCommand, id: '', name: 'unsaved2' };
    const itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO> = [savedItem1, savedItem2, unsavedItem1, unsavedItem2];
    const nameInput = page.getByLabelText('Name', { exact: true });
    const mustBeUnique = page.getByText('Must be unique');

    const typeName = async (name: string) => {
      await nameInput.fill(name);
      await userEvent.tab();
    };

    const openForEdition = (item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO, tableIndex: number) => {
      const fixture = TestBed.createComponent(EditSouthItemModalComponent);
      fixture.componentInstance.prepareForEdition(
        itemList,
        scanModes,
        [] as Array<CertificateDTO>,
        groups,
        manifest,
        item,
        southId,
        southConnectorCommand as any,
        tableIndex,
        noop,
        noop
      );
      fixture.autoDetectChanges();
    };

    test('create mode should reject the name of any existing item', async () => {
      const fixture = TestBed.createComponent(EditSouthItemModalComponent);
      fixture.componentInstance.prepareForCreation(
        itemList,
        scanModes,
        [] as Array<CertificateDTO>,
        groups,
        manifest,
        southId,
        southConnectorCommand as any,
        noop,
        noop
      );
      fixture.autoDetectChanges();

      await typeName('brand new');
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(savedItem2.name);
      await expect.element(mustBeUnique).toBeInTheDocument();

      await typeName(unsavedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('copy mode should reject the name of the copied item', async () => {
      const fixture = TestBed.createComponent(EditSouthItemModalComponent);
      fixture.componentInstance.prepareForCopy(
        itemList,
        scanModes,
        [] as Array<CertificateDTO>,
        groups,
        manifest,
        savedItem1,
        southId,
        southConnectorCommand as any,
        noop,
        noop
      );
      fixture.autoDetectChanges();

      await typeName(`${savedItem1.name}-copy`);
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(savedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify a saved item by its id rather than its table index', async () => {
      // the table index points to another item: only the id must be used to exclude the edited item
      openForEdition(savedItem2, 0);

      await typeName(savedItem2.name);
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(savedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should reject the name of an unsaved item when editing a saved item', async () => {
      openForEdition(savedItem1, 0);

      await typeName(unsavedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });

    test('edit mode should identify an unsaved item by its table index', async () => {
      openForEdition(unsavedItem2, 3);

      await typeName(unsavedItem2.name);
      await expect.element(mustBeUnique).not.toBeInTheDocument();

      await typeName(unsavedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();

      await typeName(savedItem1.name);
      await expect.element(mustBeUnique).toBeInTheDocument();
    });
  });
});
