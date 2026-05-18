import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ViewItemValueModalComponent } from './view-item-value-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

describe('ViewItemValueModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should display loading state after prepare', async () => {
    const fixture = TestBed.createComponent(ViewItemValueModalComponent);
    fixture.componentInstance.prepare('folder-scanner');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-body')).toBeInTheDocument();
    // loading state is visible before data arrives
    expect(fixture.componentInstance.loading).toBe(true);
  });

  test('should display value after setData', async () => {
    const fixture = TestBed.createComponent(ViewItemValueModalComponent);
    fixture.componentInstance.prepare('folder-scanner');
    fixture.componentInstance.setData(
      { itemId: 'id1', itemName: 'item1', queryTime: null, value: 'test-value', trackedInstant: null },
      'GroupA'
    );
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-body')).toBeInTheDocument();
    expect(fixture.componentInstance.loading).toBe(false);
  });

  test('should dismiss on close', () => {
    const fixture = TestBed.createComponent(ViewItemValueModalComponent);
    fixture.componentInstance.prepare('folder-scanner');
    fixture.detectChanges();

    fixture.componentInstance.close();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
