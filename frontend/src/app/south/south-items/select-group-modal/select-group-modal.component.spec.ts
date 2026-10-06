import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';

import testData from '../../../../../../backend/src/tests/utils/test-data';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ModalService } from '../../../shared/modal.service';
import { SelectGroupModalComponent } from './select-group-modal.component';

const manifest = testData.south.manifest;
const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
const groups: Array<SouthItemGroupDTO> = [
  {
    id: 'group1',
    createdAt: '',
    updatedAt: '',
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    standardSettings: { name: 'GroupA', scanMode: scanModes[0] },
    historySettings: {
      startTimeOffset: null,
      endTimeOffset: null,
      maxReadInterval: null,
      readDelay: null,
      recoveryStrategy: null,
      cachingStrategy: null
    }
  }
];

describe('SelectGroupModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    const modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  test('should render groups after prepare', async () => {
    const fixture = TestBed.createComponent(SelectGroupModalComponent);
    fixture.componentInstance.prepare(groups, scanModes, manifest, () => of({} as any));
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.dropdown-menu, .group-list, [id="group-none"]')).toBeInTheDocument();
  });
});
