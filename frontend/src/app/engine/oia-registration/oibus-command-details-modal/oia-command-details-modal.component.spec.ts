import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { OiaCommandDetailsModalComponent } from './oia-command-details-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { OIBusCommandDTO } from '../../../../../../backend/shared/model/command.model';

describe('OiaCommandDetailsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should display command details after prepare', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[0] as unknown as OIBusCommandDTO;
    const fixture = TestBed.createComponent(OiaCommandDetailsModalComponent);
    fixture.componentInstance.prepare(command);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-body')).toBeInTheDocument();
    expect(fixture.componentInstance.command()).toBe(command);
  });

  test('should close modal', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[0] as unknown as OIBusCommandDTO;
    const fixture = TestBed.createComponent(OiaCommandDetailsModalComponent);
    fixture.componentInstance.prepare(command);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const closeButton = root.getByCss('#close-button');
    await closeButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
