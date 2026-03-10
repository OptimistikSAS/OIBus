import { Component, effect, inject } from '@angular/core';
import { firstValueFrom, startWith, Subject, switchMap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { CertificateService } from '../../services/certificate.service';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { ClipboardCopyDirective } from '../../shared/clipboard-copy-directive';
import { DownloadService } from '../../services/download.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

type CertificateSortField = 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-certificate-list',
  imports: [
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    DatetimePipe,
    ClipboardCopyDirective,
    OibHelpComponent,
    NgbTooltip,
    TranslateModule,
    PaginationComponent
  ],
  templateUrl: './certificate-list.component.html',
  styleUrl: './certificate-list.component.scss'
})
export class CertificateListComponent {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private certificateService = inject(CertificateService);
  private downloadService = inject(DownloadService);

  private refreshTrigger = new Subject<void>();
  readonly certificates = toSignal(
    this.refreshTrigger.pipe(
      startWith(undefined),
      switchMap(() => this.certificateService.list())
    )
  );

  sortField: CertificateSortField = null;
  sortDirection: SortDirection = 'asc';
  displayedCertificates: Page<CertificateDTO> = emptyPage();

  constructor() {
    effect(() => {
      const certs = this.certificates();
      if (certs) {
        this.updateList(certs, 0);
      }
    });
  }

  /**
   * Open a modal to edit a certificate
   */
  editCertificate(certificate: CertificateDTO) {
    const modalRef = this.modalService.open(EditCertificateModalComponent, {
      size: 'lg',
      beforeDismiss: () => {
        const component: EditCertificateModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditCertificateModalComponent = modalRef.componentInstance;
    component.prepareForEdition(certificate);
    this.refreshAfterEditCertificateModalClosed(modalRef, 'updated');
  }

  /**
   * Open a modal to create a certificate
   */
  addCertificate() {
    const modalRef = this.modalService.open(EditCertificateModalComponent, {
      size: 'lg',
      beforeDismiss: () => {
        const component: EditCertificateModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditCertificateModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditCertificateModalClosed(modalRef, 'created');
  }

  private refreshAfterEditCertificateModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result.subscribe((certificate: CertificateDTO) => {
      this.refreshTrigger.next();
      this.notificationService.success(`engine.certificate.${mode}`, {
        name: certificate.name
      });
    });
  }

  deleteCertificate(certificate: CertificateDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.certificate.confirm-deletion',
        interpolateParams: { name: certificate.name }
      })
      .pipe(switchMap(() => this.certificateService.delete(certificate.id)))
      .subscribe(() => {
        this.refreshTrigger.next();
        this.notificationService.success('engine.certificate.deleted', {
          name: certificate.name
        });
      });
  }

  downloadCertificate(certificate: CertificateDTO) {
    this.downloadService.downloadFile({ blob: new Blob([certificate.certificate]), name: certificate.name + '.pem' });
  }

  toggleSort(field: CertificateSortField) {
    if (!field) return;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    const certs = this.certificates();
    if (certs) {
      this.updateList(certs, 0);
    }
  }

  getSortIcon(field: CertificateSortField): string {
    if (this.sortField !== field) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    const certs = this.certificates();
    if (certs) {
      this.updateList(certs, pageNumber);
    }
  }

  private updateList(allCerts: Array<CertificateDTO>, pageNumber: number) {
    let sorted = [...allCerts];
    if (this.sortField) {
      const direction = this.sortDirection === 'asc' ? 1 : -1;
      const field = this.sortField;
      sorted = sorted.sort((a, b) => {
        const aVal = field === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
        const bVal = field === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
        return aVal.localeCompare(bVal) * direction;
      });
    }
    this.displayedCertificates = createPageFromArray(sorted, PAGE_SIZE, pageNumber);
  }
}
