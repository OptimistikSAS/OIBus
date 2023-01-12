import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfirmationModalComponent } from './confirmation-modal/confirmation-modal.component';
import { TranslateService } from '@ngx-translate/core';
import { ModalService } from './modal.service';

/**
 * The options that are passed when opening a confirmation modal.
 * If a title is provided, the title key is ignored. Same for message and message key, yes and yes key, no and no key.
 * If there is no title and no title key, then the common confirmation key is used. Same for yes and no button labels.
 * If errorOnClose is true, then clicking "No" in the modal makes the returned observable emit an error. Otherwise,
 * the observable just doesn't emit anything and completes.
 */
export interface ConfirmationOptions {
  message?: string;
  messageKey?: string;
  title?: string;
  titleKey?: string;
  yes?: string;
  yesKey?: string;
  no?: string;
  noKey?: string;
  errorOnClose?: boolean;
  interpolateParams?: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  constructor(private modalService: ModalService, private translateService: TranslateService) {}

  /**
   * Opens a confirmation modal, and returns an observable, which emits and completes if the user clicks "Yes".
   * If `errorOnClose` is true, then clicking "No" in the modal makes the returned observable emit an error. Otherwise,
   * the observable just doesn't emit anything and completes.
   */
  confirm(options: ConfirmationOptions): Observable<void> {
    const modalRef = this.modalService.open(ConfirmationModalComponent, options);
    modalRef.componentInstance.title =
      options.title || this.translateService.instant(options.titleKey || 'common.confirmation-modal-title');
    modalRef.componentInstance.yes = options.yes || this.translateService.instant(options.yesKey || 'common.yes');
    modalRef.componentInstance.no = options.no || this.translateService.instant(options.noKey || 'common.no');
    modalRef.componentInstance.message = options.message || this.translateService.instant(options.messageKey!, options.interpolateParams);
    return modalRef.result;
  }
}
