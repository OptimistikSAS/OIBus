import { Injectable, Type } from '@angular/core';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { catchError, EMPTY, from, throwError } from 'rxjs';

/**
 * The options that are passed when opening a modal.
 * If `errorOnClose` is true, then canceling the modal makes the returned observable emit an error.
 * Otherwise, the observable just doesn't emit anything and completes.
 */
export interface ModalOptions extends NgbModalOptions {
  errorOnClose?: boolean;
}

export class Modal<T> {
  private options: ModalOptions;

  constructor(private ngbModalRef: NgbModalRef, options?: ModalOptions) {
    this.options = { errorOnClose: false, ...options };
  }

  get componentInstance(): T {
    return this.ngbModalRef.componentInstance;
  }

  get result() {
    return from(this.ngbModalRef.result).pipe(
      catchError(err => (this.options.errorOnClose ? throwError(() => err || 'not confirmed') : EMPTY))
    );
  }

  dismiss() {
    this.ngbModalRef.dismiss();
  }
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  constructor(private ngbModal: NgbModal) {}

  /**
   * Opens a modal containing an instance of the given component, and returns a `Modal` instance,
   * The `Modal` instance contains the `componentInstance`,
   * and a `result` field, which is an observable, which emits and completes if the user validates.
   * You can also give options to the modal.
   * If `errorOnClose` is true, then canceling the modal makes the returned observable emit an error.
   * Otherwise, the observable just doesn't emit anything and completes.
   */
  open<T>(modalComponent: Type<T>, options?: ModalOptions): Modal<T> {
    return new Modal(this.ngbModal.open(modalComponent, options), options);
  }
}
