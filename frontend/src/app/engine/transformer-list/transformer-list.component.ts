import { Component, inject, OnInit } from '@angular/core';

import { firstValueFrom, switchMap, tap } from 'rxjs';
import { Modal, ModalService } from '../../shared/modal.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TransformerService } from '../../services/transformer.service';
import { CustomTransformerDTO } from '../../../../../backend/shared/model/transformer.model';
import { EditTransformerModalComponent } from './edit-transformer-modal/edit-transformer-modal.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { DatetimePipe } from '../../shared/datetime.pipe';

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
    TranslateModule,
    PaginationComponent,
    DatetimePipe
  ],
  templateUrl: './transformer-list.component.html',
  styleUrl: './transformer-list.component.scss'
})
export class TransformerListComponent implements OnInit {
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private notificationService = inject(NotificationService);
  private transformerService = inject(TransformerService);

  allTransformers: Array<CustomTransformerDTO> = [];
  private filteredTransformers: Array<CustomTransformerDTO> = [];
  displayedTransformers: Page<CustomTransformerDTO> = emptyPage();
  sortField: TransformerSortField = null;
  sortDirection: SortDirection = 'asc';

  ngOnInit() {
    this.transformerService.list().subscribe(transformers => {
      this.allTransformers = transformers.filter(element => element.type === 'custom') as Array<CustomTransformerDTO>;
      this.updateList(0);
    });
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

  private refreshAfterEditTransformerModalClosed(modalRef: Modal<any>, mode: 'created' | 'updated') {
    modalRef.result
      .pipe(
        tap(transformer =>
          this.notificationService.success(`configuration.oibus.manifest.transformers.${mode}`, {
            name: transformer.name
          })
        ),
        switchMap(() => this.transformerService.list())
      )
      .subscribe(transformers => {
        this.allTransformers = transformers.filter(element => element.type === 'custom') as Array<CustomTransformerDTO>;
        this.updateList(0);
      });
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
        this.transformerService.list().subscribe(transformers => {
          this.allTransformers = transformers.filter(element => element.type === 'custom') as Array<CustomTransformerDTO>;
          this.updateList(0);
        });
        this.notificationService.success('configuration.oibus.manifest.transformers.deleted', {
          name: transformer.name
        });
      });
  }

  toggleSort(field: TransformerSortField) {
    if (!field) return;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.updateList(0);
  }

  getSortIcon(field: TransformerSortField): string {
    if (this.sortField !== field) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  }

  changePage(pageNumber: number) {
    this.displayedTransformers = createPageFromArray(this.filteredTransformers, PAGE_SIZE, pageNumber);
  }

  private updateList(pageNumber: number) {
    this.filteredTransformers = [...this.allTransformers];
    this.sortList();
    this.changePage(pageNumber);
  }

  private sortList() {
    if (!this.sortField) return;
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.filteredTransformers = [...this.filteredTransformers].sort((a, b) => {
      if (this.sortField === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      const aVal = this.sortField === 'createdAt' ? (a.createdAt ?? '') : (a.updatedAt ?? '');
      const bVal = this.sortField === 'createdAt' ? (b.createdAt ?? '') : (b.updatedAt ?? '');
      return aVal.localeCompare(bVal) * direction;
    });
  }
}
