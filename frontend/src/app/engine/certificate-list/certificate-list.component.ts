import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, switchMap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';

import { CertificateService } from '../../services/certificate.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../../shared/audit-info/audit-info.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ClipboardCopyDirective } from '../../shared/clipboard-copy-directive';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DocsUrlService } from '../../shared/docs-url.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { emptyPage } from '../../shared/utils/page.utils';
import { EditCertificateModalComponent } from './edit-certificate-modal/edit-certificate-modal.component';
import { ExportCertificateModalComponent } from './export-certificate-modal/export-certificate-modal.component';
import { ImportCertificateModalComponent } from './import-certificate-modal/import-certificate-modal.component';

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
    TranslatePipe,
    PaginationComponent,
    AuditInfoComponent
  ],
  templateUrl: './certificate-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './certificate-list.component.scss'
})
export class CertificateListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly certificateService = inject(CertificateService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly helpUrl = this.docsUrlService.resolve('guide/engine/engine-settings');

  private readonly certificatesResource = rxResource({ stream: () => this.certificateService.list() });
  /** All the certificates, kept while they are reloaded */
  readonly certificates = computed(() => (this.certificatesResource.hasValue() ? this.certificatesResource.value() : undefined));

  readonly sortField = signal<CertificateSortField>(null);
  readonly sortDirection = signal<SortDirection>('asc');
  /** Back to the first page when the certificates or their order change */
  private readonly pageNumber = linkedSignal({
    source: () => ({ certificates: this.certificates(), sortField: this.sortField(), sortDirection: this.sortDirection() }),
    computation: () => 0
  });
  readonly displayedCertificates = computed<Page<CertificateDTO>>(() => {
    const certificates = this.certificates();
    if (!certificates) {
      return emptyPage();
    }
    return createPageFromArray(sortCertificates(certificates, this.sortField(), this.sortDirection()), PAGE_SIZE, this.pageNumber());
  });

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

  /**
   * Open a modal to import a certificate
   */
  importCertificate() {
    const modalRef = this.modalService.open(ImportCertificateModalComponent, {
      size: 'lg',
      beforeDismiss: () => {
        const component: ImportCertificateModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    this.refreshAfterEditCertificateModalClosed(modalRef, 'imported');
  }

  /**
   * Open a modal to export a certificate
   */
  exportCertificate(certificate: CertificateDTO) {
    const modalRef = this.modalService.open(ExportCertificateModalComponent, {
      size: 'lg',
      beforeDismiss: () => {
        const component: ExportCertificateModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: ExportCertificateModalComponent = modalRef.componentInstance;
    component.prepare(certificate);
  }

  private refreshAfterEditCertificateModalClosed(
    modalRef: Modal<EditCertificateModalComponent | ImportCertificateModalComponent>,
    mode: 'created' | 'updated' | 'imported'
  ) {
    modalRef.result.subscribe((certificate: CertificateDTO) => {
      this.certificatesResource.reload();
      this.notificationService.success(`engine.certificate.${mode}`, {
        name: certificate.name
      });
    });
  }

  /**
   * Open a modal to view the audit history of a certificate
   */
  showAudit(certificate: CertificateDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('certificate', certificate.id);
  }

  deleteCertificate(certificate: CertificateDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'engine.certificate.confirm-deletion',
        interpolateParams: { name: certificate.name }
      })
      .pipe(switchMap(() => this.certificateService.delete(certificate.id)))
      .subscribe(() => {
        this.certificatesResource.reload();
        this.notificationService.success('engine.certificate.deleted', {
          name: certificate.name
        });
      });
  }

  toggleSort(field: CertificateSortField) {
    if (!field) return;
    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: CertificateSortField): string {
    if (this.sortField() !== field) return 'fa-sort';
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.pageNumber.set(pageNumber);
  }
}

function sortCertificates(
  certificates: Array<CertificateDTO>,
  field: CertificateSortField,
  direction: SortDirection
): Array<CertificateDTO> {
  if (!field) {
    return certificates;
  }
  const factor = direction === 'asc' ? 1 : -1;
  return [...certificates].sort((a, b) => {
    const aVal = field === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
    const bVal = field === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
    return aVal.localeCompare(bVal) * factor;
  });
}
