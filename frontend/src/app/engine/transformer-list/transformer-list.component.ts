import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, map, Observable, switchMap, tap } from 'rxjs';

import { CustomTransformerDTO, TransformerDTO } from '@oibus/shared/api/transformer.model';
import { createPageFromArray, Page } from '@oibus/shared/common/types';

import { TransformerService } from '../../services/transformer.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { AuditInfoComponent } from '../../shared/audit-info/audit-info.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { emptyPage } from '../../shared/utils/page.utils';
import { EditTransformerModalComponent } from './edit-transformer-modal/edit-transformer-modal.component';

type TransformerSortField = 'name' | 'createdAt' | 'updatedAt' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

@Component({
  selector: 'oib-transformer-list',
  imports: [
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    NgbTooltip,
    TranslatePipe,
    PaginationComponent,
    AuditInfoComponent
  ],
  templateUrl: './transformer-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './transformer-list.component.scss'
})
export class TransformerListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly transformerService = inject(TransformerService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly helpUrl = this.docsUrlService.resolve('guide/engine/transformers');

  readonly allTransformers = signal<Array<CustomTransformerDTO>>([]);
  private filteredTransformers: Array<CustomTransformerDTO> = [];
  readonly displayedTransformers = signal<Page<CustomTransformerDTO>>(emptyPage());
  readonly sortField = signal<TransformerSortField>(null);
  readonly sortDirection = signal<SortDirection>('asc');

  constructor() {
    this.loadTransformers().subscribe();
  }

  private loadTransformers(): Observable<Array<CustomTransformerDTO>> {
    return this.transformerService.list().pipe(
      map(transformers => transformers.filter((element): element is CustomTransformerDTO => element.type === 'custom')),
      tap(transformers => {
        this.allTransformers.set(transformers);
        this.updateList(0);
      })
    );
  }

  editTransformer(transformer: CustomTransformerDTO) {
    const modalRef = this.modalService.open(EditTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditTransformerModalComponent = modalRef.componentInstance;
    component.prepareForEdition(transformer);
    this.refreshAfterEditTransformerModalClosed(modalRef, 'updated');
  }

  addTransformer() {
    const modalRef = this.modalService.open(EditTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditTransformerModalComponent = modalRef.componentInstance;
    component.prepareForCreation();
    this.refreshAfterEditTransformerModalClosed(modalRef, 'created');
  }

  private refreshAfterEditTransformerModalClosed(modalRef: Modal<EditTransformerModalComponent>, mode: 'created' | 'updated') {
    modalRef.result
      .pipe(
        tap((transformer: TransformerDTO) =>
          this.notificationService.success(`configuration.oibus.manifest.transformers.${mode}`, {
            name: transformer.type === 'custom' ? transformer.name : transformer.functionName
          })
        ),
        switchMap(() => this.loadTransformers())
      )
      .subscribe();
  }

  /**
   * Open a modal to view the audit history of a custom transformer
   */
  showAudit(transformer: CustomTransformerDTO) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('transformer', transformer.id);
  }

  deleteTransformer(transformer: CustomTransformerDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'configuration.oibus.manifest.transformers.confirm-deletion',
        interpolateParams: { name: transformer.name }
      })
      .pipe(
        switchMap(() => {
          return this.transformerService.delete(transformer.id);
        })
      )
      .subscribe(() => {
        this.loadTransformers().subscribe();
        this.notificationService.success('configuration.oibus.manifest.transformers.deleted', {
          name: transformer.name
        });
      });
  }

  toggleSort(field: TransformerSortField) {
    if (!field) return;
    if (this.sortField() === field) {
      this.sortDirection.update(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.updateList(0);
  }

  getSortIcon(field: TransformerSortField): string {
    if (this.sortField() !== field) return 'fa-sort';
    return this.sortDirection() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  changePage(pageNumber: number) {
    this.displayedTransformers.set(createPageFromArray(this.filteredTransformers, PAGE_SIZE, pageNumber));
  }

  private updateList(pageNumber: number) {
    this.filteredTransformers = [...this.allTransformers()];
    this.sortList();
    this.changePage(pageNumber);
  }

  private sortList() {
    const sortField = this.sortField();
    if (!sortField) return;
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    this.filteredTransformers = [...this.filteredTransformers].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      const aVal = sortField === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
      const bVal = sortField === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
      return aVal.localeCompare(bVal) * direction;
    });
  }
}
