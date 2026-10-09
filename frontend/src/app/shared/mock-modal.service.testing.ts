import { Service, Type } from '@angular/core';

import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, throwError } from 'rxjs';

import { createMock } from '../../test/vitest-create-mock';
import { Modal, ModalOptions, ModalService } from './modal.service';

/**
 * A modal whose component instance and result are given, instead of being produced by ng-bootstrap.
 */
class FakeModal<T> extends Modal<T> {
  constructor(
    private readonly fakeComponentInstance: T,
    private readonly fakeResult: Observable<unknown>
  ) {
    super(createMock(NgbModalRef));
  }

  override get componentInstance(): T {
    return this.fakeComponentInstance;
  }

  override get result() {
    return this.fakeResult;
  }
}

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
@Service()
export class MockModalService<T> {
  private modal: Modal<T> | null = null;

  mockClosedModal(componentInstance: T, value: unknown = '') {
    this.modal = new FakeModal(componentInstance, of(value));
  }

  mockDismissedModal(componentInstance: T) {
    this.modal = new FakeModal(componentInstance, of());
  }

  mockDismissedWithErrorModal(componentInstance: T) {
    this.modal = new FakeModal(
      componentInstance,
      throwError(() => 'not-confirmed')
    );
  }

  open(_modalComponent: Type<T>, _options?: ModalOptions): Modal<T> {
    if (!this.modal) {
      throw new Error('You need to setup your mock modal in your test by using mockClosedModal, mockDismissedModal...');
    }
    return this.modal;
  }
}

/**
 * Providers that can be used in unit tests to mock modals.
 * It replaces ModalService by a MockModalService, that you can inject to emulate a closed or dismissed modal.
 * Add the providers to your testing module to use it
 * ```
 * providers: [provideModalTesting()]
 * ```
 * It will replace the `ModalService` with the mock one, that you can manually control.
 */
export const provideModalTesting = () => [MockModalService, { provide: ModalService, useExisting: MockModalService }];

/**
 * A real `Modal` wrapping a fake ng-bootstrap modal, for tests where an opener opens several modals in a row
 * (which `MockModalService` cannot express).
 * @param componentInstance the (usually mocked) modal component
 * @param result the value the modal closes with; by default the modal stays open
 */
export function fakeModal<T>(componentInstance: T, result = new Promise<unknown>(() => undefined)): Modal<T> {
  return new Modal<T>(createMock(NgbModalRef, { componentInstance, result }));
}
