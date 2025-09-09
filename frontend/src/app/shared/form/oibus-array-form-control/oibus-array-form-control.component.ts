import { Component, computed, inject, input } from '@angular/core';
import { ControlContainer, FormControl, FormGroup, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { OIBusArrayAttribute, OIBusAttributeType } from '../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';
import { PaginationComponent } from '../../pagination/pagination.component';
import { ModalService } from '../../modal.service';
import { ArrayPage } from '../../pagination/array-page';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal/oibus-edit-array-element-modal.component';
import { ValErrorDelayDirective } from '../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ExportItemModalComponent } from '../../export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../import-item-modal/import-item-modal.component';
import { NotificationService } from '../../notification.service';
import { ImportArrayValidationModalComponent } from './import-array-validation-modal/import-array-validation-modal.component';
import { exportArrayElements, validateArrayElementsImport } from '../../utils/csv.utils';
import { DownloadService } from '../../../services/download.service';
import { FormUtils } from '../form-utils';

@Component({
  selector: 'oib-oibus-array-form-control',
  templateUrl: './oibus-array-form-control.component.html',
  styleUrl: './oibus-array-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    PaginationComponent,
    ValErrorDelayDirective,
    ValidationErrorsComponent,
    NgbTooltip
  ]
})
export class OIBusArrayFormControlComponent {
  private modalService = inject(ModalService);
  private translateService = inject(TranslateService);
  private notificationService = inject(NotificationService);
  private downloadService = inject(DownloadService);

  scanModes = input.required<Array<ScanModeDTO>>();
  certificates = input.required<Array<CertificateDTO>>();
  parentGroup = input.required<FormGroup>();
  control = input.required<FormControl<Array<any>>>();
  arrayAttribute = input.required<OIBusArrayAttribute>();
  southId = input<string>();

  private readonly controlValue = toSignal(toObservable(this.control).pipe(switchMap(c => c.valueChanges.pipe(startWith(c.value)))));
  readonly columns = computed(() => FormUtils.buildColumn(this.arrayAttribute().rootAttribute, []));
  readonly paginatedValues = computed(() => {
    if (this.arrayAttribute().paginate) {
      return new ArrayPage(this.controlValue()!, this.arrayAttribute().numberOfElementPerPage);
    }
    return new ArrayPage([], 1);
  });

  addElement(event: Event) {
    event.preventDefault();
    const modal = this.modalService.open(OIBusEditArrayElementModalComponent, { size: 'xl' });
    modal.componentInstance.prepareForCreation(
      this.scanModes(),
      this.certificates(),
      this.parentGroup(),
      this.arrayAttribute().rootAttribute
    );

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
    });
  }

  copyElement(element: any) {
    const modal = this.modalService.open(OIBusEditArrayElementModalComponent, { size: 'xl' });
    modal.componentInstance.prepareForCopy(
      this.scanModes(),
      this.certificates(),
      this.parentGroup(),
      element,
      this.arrayAttribute().rootAttribute
    );

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
    });
  }

  editElement(element: any) {
    const modal = this.modalService.open(OIBusEditArrayElementModalComponent, { size: 'xl' });
    modal.componentInstance.prepareForEdition(
      this.scanModes(),
      this.certificates(),
      this.parentGroup(),
      element,
      this.arrayAttribute().rootAttribute
    );

    modal.result.subscribe(arrayElement => {
      const newArray = [...this.control().value];
      const index = this.control().value.indexOf(element);
      newArray[index] = { ...arrayElement, id: element.id };

      this.control().setValue(newArray);
      this.paginatedValues().gotoPage(0);
    });
  }

  deleteElement(element: any) {
    const newArray = [...this.control().value];
    const index = this.control().value.indexOf(element);
    newArray.splice(index, 1);
    this.control().setValue(newArray);
    this.paginatedValues().gotoPage(0);
  }

  formatValue(element: any, path: Array<string>, type: OIBusAttributeType, translationKey: string) {
    return FormUtils.formatValue(element, path, type, translationKey, this.translateService, this.scanModes());
  }

  exportArray() {
    const modal = this.modalService.open(ExportItemModalComponent);
    modal.componentInstance.prepare(this.arrayAttribute().key);

    modal.result.subscribe(result => {
      if (result) {
        const elements = this.control().value!;
        const blob = exportArrayElements(this.arrayAttribute(), elements, result.delimiter);
        this.downloadService.downloadFile({ blob, name: result.filename });
      }
    });
  }

  importArray() {
    const modal = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });
    const headers: Array<string> = [];
    const optionalHeaders: Array<string> = [];
    if (this.arrayAttribute().rootAttribute.attributes) {
      this.arrayAttribute().rootAttribute.attributes.forEach(attr => {
        if (
          attr.validators.some(validation => validation.type === 'REQUIRED') &&
          !this.arrayAttribute().rootAttribute.enablingConditions.some(condition => condition.targetPathFromRoot === attr.key)
        ) {
          headers.push(attr.key);
        } else {
          optionalHeaders.push(attr.key);
        }
      });
    }
    modal.componentInstance.prepare(headers, optionalHeaders, [], false);
    modal.result
      .pipe(
        switchMap(response => {
          if (!response) return of(null);
          return this.checkImportArray(response.file, response.delimiter);
        })
      )
      .subscribe();
  }

  private async checkImportArray(file: File, delimiter: string) {
    const { elements, errors } = await validateArrayElementsImport(file, delimiter, this.arrayAttribute(), this.control().value || []);
    const modalRef = this.modalService.open(ImportArrayValidationModalComponent, { size: 'xl', backdrop: 'static' });
    modalRef.componentInstance.prepare(this.arrayAttribute(), elements, errors);
    modalRef.result.subscribe({
      next: (importedElements: Array<Record<string, unknown>>) => {
        this.control().setValue(importedElements);
        this.paginatedValues().gotoPage(0);
        this.notificationService.success('common.import-success');
      },
      error: () => {
        this.notificationService.error('common.import-error');
      }
    });
  }
}
