import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import EditSouthItemModalComponent from './edit-south-item-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { ModalService } from '../../../shared/modal.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthConnectorItemDTO, SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const southConnectorCommand = testData.south.command;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const southId = testData.south.list[0].id;
const existingItem = testData.south.list[0].items[0] as unknown as SouthConnectorItemDTO;
const groups: Array<SouthItemGroupDTO> = [];
const noop = () => of({} as any);

const buildGroup = (id: string, name: string, scanMode: ScanModeDTO): SouthItemGroupDTO => ({
  id,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: { name, scanMode },
  historySettings: { overlap: 0, maxReadInterval: 3600, readDelay: 200 }
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
});
