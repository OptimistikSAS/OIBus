import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ModalService } from './modal.service';

@Component({ selector: 'oib-test-modal-component', template: 'Hello', changeDetection: ChangeDetectionStrategy.OnPush })
export class TestModalComponent {}

describe('ModalService', () => {
  let ngbModal: NgbModal;
  let modalService: ModalService;
  const fakeModalComponent = new TestModalComponent();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    ngbModal = TestBed.inject(NgbModal);
    modalService = TestBed.inject(ModalService);
  });

  test('should create a modal instance', () => {
    vi.spyOn(ngbModal, 'open').mockReturnValue({
      componentInstance: fakeModalComponent,
      result: Promise.resolve()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent, { size: 'lg' });

    expect(ngbModal.open).toHaveBeenCalledWith(TestModalComponent, { size: 'lg' });
    expect(modal.componentInstance).toBe(fakeModalComponent);
  });

  test('should emit on close', async () => {
    vi.spyOn(ngbModal, 'open').mockReturnValue({
      componentInstance: fakeModalComponent,
      result: Promise.resolve()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent);
    let closed = false;
    modal.result.subscribe(() => (closed = true));

    await Promise.resolve();
    expect(closed).toBe(true);
  });

  test('should emit EMPTY on cancel', async () => {
    vi.spyOn(ngbModal, 'open').mockReturnValue({
      componentInstance: fakeModalComponent,
      result: Promise.reject()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent);
    let closed = false;
    modal.result.subscribe(() => (closed = true));

    await Promise.resolve();
    expect(closed).toBe(false);
  });

  test('should throw error on cancel if options says so', async () => {
    vi.spyOn(ngbModal, 'open').mockReturnValue({
      componentInstance: fakeModalComponent,
      result: Promise.reject()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent, { errorOnClose: true });

    expect(ngbModal.open).toHaveBeenCalledWith(TestModalComponent, { errorOnClose: true } as any);
    expect(modal.componentInstance).toBe(fakeModalComponent);

    let hasError = false;
    modal.result.subscribe({ error: () => (hasError = true) });

    await Promise.resolve();
    expect(hasError).toBe(true);
  });
});
