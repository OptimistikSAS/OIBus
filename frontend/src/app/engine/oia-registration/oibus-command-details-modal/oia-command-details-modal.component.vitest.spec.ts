import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { OiaCommandDetailsModalComponent } from './oia-command-details-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { OIBusCommandDTO } from '../../../../../../backend/shared/model/command.model';

const command: OIBusCommandDTO = {
  id: 'commandId1',
  type: 'restart-engine',
  status: 'COMPLETED',
  result: 'Engine restarted',
  retrievedDate: '2020-01-01T00:00:00Z',
  completedDate: '2020-01-01T00:01:00Z'
} as unknown as OIBusCommandDTO;

describe('OiaCommandDetailsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should display command details after prepare', async () => {
    const fixture = TestBed.createComponent(OiaCommandDetailsModalComponent);
    fixture.componentInstance.prepare(command);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root).toBeInTheDocument();
    expect(fixture.componentInstance.command()).toBe(command);
  });

  test('should close modal', async () => {
    const fixture = TestBed.createComponent(OiaCommandDetailsModalComponent);
    fixture.componentInstance.prepare(command);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const closeButton = root.getByCss('#close-button');
    await closeButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
