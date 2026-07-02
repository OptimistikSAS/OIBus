import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { EditSouthItemGroupModalComponent } from './edit-south-item-group-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const existingGroup: SouthItemGroupDTO = {
  id: 'group1',
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  standardSettings: {
    name: 'GroupA',
    scanMode: scanModes[0]
  },
  historySettings: { startTimeOffset: null, endTimeOffset: null, maxReadInterval: null, readDelay: null, recoveryStrategy: null }
};

describe('EditSouthItemGroupModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    const unsavedChangesService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should populate form in edit mode', async () => {
    const fixture = TestBed.createComponent(EditSouthItemGroupModalComponent);
    fixture.componentInstance.prepareForEdition(scanModes, [existingGroup], manifest, existingGroup);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#group-name')).toHaveValue('GroupA');
  });

  test('should render create mode', async () => {
    const fixture = TestBed.createComponent(EditSouthItemGroupModalComponent);
    fixture.componentInstance.prepareForCreation(scanModes, [], manifest);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#group-name')).toBeInTheDocument();
  });
});
