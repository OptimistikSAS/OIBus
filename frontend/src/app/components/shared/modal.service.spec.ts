import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Component } from '@angular/core';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { ModalService } from './modal.service';

@Component({
  template: 'Hello'
})
export class TestModalComponent {}

describe('ModalService', () => {
  let ngbModal: NgbModal;
  let modalService: ModalService;
  const fakeModalComponent = new TestModalComponent();

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TestModalComponent],
      providers: [ModalService]
    });
    ngbModal = TestBed.inject(NgbModal);
    modalService = TestBed.inject(ModalService);
  });

  it('should create a modal instance', fakeAsync(() => {
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: fakeModalComponent,
      result: Promise.resolve()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent, { size: 'lg' });

    expect(ngbModal.open).toHaveBeenCalledWith(TestModalComponent, { size: 'lg' });
    expect(modal.componentInstance).toBe(fakeModalComponent);
  }));

  it('should emit on close', fakeAsync(() => {
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: fakeModalComponent,
      result: Promise.resolve()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent);

    let closed = false;
    modal.result.subscribe(() => (closed = true));

    // close the modal by resolving the promise
    tick();

    expect(closed).toBe(true);
  }));

  it('should emit EMPTY on cancel', fakeAsync(() => {
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: fakeModalComponent,
      result: Promise.reject()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent);

    let closed = false;
    modal.result.subscribe(() => (closed = true));

    // close the modal by resolving the promise
    tick();

    expect(closed).toBe(false);
  }));

  it('should throw error on cancel if options says so', fakeAsync(() => {
    spyOn(ngbModal, 'open').and.returnValue({
      componentInstance: fakeModalComponent,
      result: Promise.reject()
    } as NgbModalRef);

    const modal = modalService.open(TestModalComponent, { errorOnClose: true });

    expect(ngbModal.open).toHaveBeenCalledWith(TestModalComponent, { errorOnClose: true } as NgbModalOptions);
    expect(modal.componentInstance).toBe(fakeModalComponent);

    let hasError = false;
    modal.result.subscribe({ error: () => (hasError = true) });

    // close the modal by resolving the promise
    tick();

    expect(hasError).toBe(true);
  }));
});
