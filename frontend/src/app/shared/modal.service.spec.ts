import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ModalService } from './modal.service';
import { noAnimation } from './test-utils';

@Component({ selector: 'oib-test-modal-component', template: 'Hello', changeDetection: ChangeDetectionStrategy.OnPush })
class TestModalComponent {
  readonly activeModal = inject(NgbActiveModal);
}

describe('ModalService', () => {
  let ngbModal: NgbModal;
  let modalService: ModalService;
  const dialog = page.getByRole('dialog');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [noAnimation] });
    ngbModal = TestBed.inject(NgbModal);
    modalService = TestBed.inject(ModalService);
  });

  afterEach(() => ngbModal.dismissAll());

  test('should open a modal with the given component and options', async () => {
    vi.spyOn(ngbModal, 'open');

    const modal = modalService.open(TestModalComponent, { size: 'lg' });

    expect(ngbModal.open).toHaveBeenCalledWith(TestModalComponent, { size: 'lg' });
    expect(modal.componentInstance).toBeInstanceOf(TestModalComponent);
    await expect.element(dialog).toHaveTextContent('Hello');
  });

  test('should emit the result on close', async () => {
    const modal = modalService.open(TestModalComponent);

    modal.componentInstance.activeModal.close('result');

    await expect(firstValueFrom(modal.result)).resolves.toBe('result');
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test('should complete without emitting on cancel', async () => {
    const modal = modalService.open(TestModalComponent);

    modal.componentInstance.activeModal.dismiss('cancel');

    await expect(firstValueFrom(modal.result, { defaultValue: 'completed' })).resolves.toBe('completed');
  });

  test('should throw the dismiss reason on cancel if options says so', async () => {
    const modal = modalService.open(TestModalComponent, { errorOnClose: true });

    modal.componentInstance.activeModal.dismiss('cancel');

    await expect(firstValueFrom(modal.result)).rejects.toBe('cancel');
  });

  test('should throw a default error on cancel without reason if options says so', async () => {
    const modal = modalService.open(TestModalComponent, { errorOnClose: true });

    modal.dismiss();

    await expect(firstValueFrom(modal.result)).rejects.toBe('not confirmed');
    await expect.element(dialog).not.toBeInTheDocument();
  });
});
