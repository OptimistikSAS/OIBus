import { Injectable, NgModule, Type } from '@angular/core';
import { Modal, ModalOptions, ModalService } from './modal.service';
import { of, throwError } from 'rxjs';

/**
 * Mock service to emulate a closed or dismissed modal.
 * You have to get it and call one of the `mockXXXModal` to set up the modal.
 * ```
 * const modalService: MockModalService<MyModalComponent> = TestBed.inject(MockModalService);
 * const fakeModalComponent = createMock(MyModalComponent);
 * modalService.mockClosedModal(fakeModalComponent);
 * ```
 * In this example, the modal will use the given component and will close immediately.
 *
 * If you forget to call the `mockXXXModal` method before using the modal,
 * an explicit error will be thrown.
 */
@Injectable()
export class MockModalService<T> {
  private modal: Modal<T> | null = null;

  mockClosedModal(componentInstance: T, value: any = '') {
    this.modal = {
      componentInstance,
      result: of(value)
    } as unknown as Modal<T>;
  }

  mockDismissedModal(componentInstance: T) {
    this.modal = {
      componentInstance,
      result: of()
    } as unknown as Modal<T>;
  }

  mockDismissedWithErrorModal(componentInstance: T) {
    this.modal = {
      componentInstance,
      result: throwError(() => 'not-confirmed')
    } as unknown as Modal<T>;
  }

  open(modalComponent: Type<T>, options?: ModalOptions): Modal<T> {
    if (!this.modal) {
      throw new Error('You need to setup your mock modal in your test by using mockClosedModal, mockDismissedModal...');
    }
    return this.modal;
  }
}

/**
 * Module that can be imported in unit tests to mock modals.
 * It replaces ModalService by a MockModalService, that you can inject to emulate a closed or dismissed modal.
 * Import the module to your testing module to use it
 * ```
 * imports: [MockModalModule]
 * ```
 * It will replace the `ModalService` with the mock one, that you can manually control.
 */
@NgModule({
  providers: [MockModalService, { provide: ModalService, useExisting: MockModalService }]
})
export class MockModalModule {}
