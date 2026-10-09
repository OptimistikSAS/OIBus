import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { ControlContainer, FormControl, FormGroup, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { of, switchMap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusArrayAttribute, OIBusAttributeType } from '@oibus/shared/connector/form.model';

import { DownloadService } from '../../../services/download.service';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';
import { ExportItemModalComponent } from '../../export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../import-item-modal/import-item-modal.component';
import { ModalService } from '../../modal.service';
import { ArrayPage } from '../../pagination/array-page';
import { PaginationComponent } from '../../pagination/pagination.component';
import { exportArrayElements, validateArrayElementsImport } from '../../utils/csv.utils';
import { FormUtils } from '../form-utils';
import { trackControl } from '../tracked-control';
import { ValErrorDelayDirective } from '../val-error-delay.directive';
import { ImportArrayValidationModalComponent } from './import-array-validation-modal/import-array-validation-modal.component';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal/oibus-edit-array-element-modal.component';

/** An element of an array attribute value, whose fields are described by the root attribute of the array */
export type ArrayElement = Record<string, unknown>;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private readonly modalService = inject(ModalService);
  private readonly translateService = inject(TranslateService);
  private readonly downloadService = inject(DownloadService);

  readonly scanModes = input.required<Array<ScanModeDTO>>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  readonly parentGroup = input.required<FormGroup>();
  readonly control = input.required<FormControl<Array<ArrayElement>>>();
  readonly arrayAttribute = input.required<OIBusArrayAttribute>();
  readonly southId = input<string>();

  /** The control is tracked so that this OnPush component renders its changes made from outside (value patched, touched...) */
  protected readonly trackedControl = trackControl(() => this.control());
  readonly controlValue = computed(() => this.trackedControl()!.value);
  readonly columns = computed(() => FormUtils.buildColumn(this.arrayAttribute().rootAttribute.attributes, []));
  /** Back to the first page when the value changes */
  readonly pageNumber = linkedSignal({ source: this.controlValue, computation: () => 0 });
  readonly paginatedValues = computed(() => {
    if (!this.arrayAttribute().paginate) {
      return new ArrayPage<ArrayElement>([], 1);
    }
    return new ArrayPage(this.controlValue(), this.arrayAttribute().numberOfElementPerPage, this.pageNumber());
  });
  readonly displayedElements = computed(() => (this.arrayAttribute().paginate ? this.paginatedValues().content : this.controlValue()));

  addElement(event: Event) {
    event.preventDefault();
    const modal = this.modalService.open(OIBusEditArrayElementModalComponent, { size: 'xl' });
    modal.componentInstance.prepareForCreation(
      this.scanModes(),
      this.certificates(),
      this.parentGroup(),
      this.arrayAttribute().rootAttribute
    );

    modal.result.subscribe(arrayElement => this.control().setValue([...this.control().value, arrayElement]));
  }

  copyElement(element: ArrayElement) {
    const modal = this.modalService.open(OIBusEditArrayElementModalComponent, { size: 'xl' });
    modal.componentInstance.prepareForCopy(
      this.scanModes(),
      this.certificates(),
      this.parentGroup(),
      element,
      this.arrayAttribute().rootAttribute
    );

    modal.result.subscribe(arrayElement => this.control().setValue([...this.control().value, arrayElement]));
  }

  editElement(element: ArrayElement) {
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
      newArray[index] = { ...arrayElement, id: element['id'] };
      this.control().setValue(newArray);
    });
  }

  deleteElement(element: ArrayElement) {
    const newArray = [...this.control().value];
    newArray.splice(this.control().value.indexOf(element), 1);
    this.control().setValue(newArray);
  }

  formatValue(element: ArrayElement, path: Array<string>, type: OIBusAttributeType, translationKey: string) {
    return FormUtils.formatValue(element, path, type, translationKey, this.translateService, this.scanModes());
  }

  exportArray() {
    const modal = this.modalService.open(ExportItemModalComponent);
    modal.componentInstance.prepare(this.arrayAttribute().key);

    modal.result.subscribe(result => {
      if (result) {
        const elements = this.control().value;
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
    modal.componentInstance.prepare(headers, optionalHeaders, [], false, true);
    modal.result
      .pipe(
        switchMap(response => {
          if (!response) return of(null);
          return this.checkImportArray(response.file, response.delimiter, response.eraseExisting);
        })
      )
      .subscribe();
  }

  private async checkImportArray(file: File, delimiter: string, eraseExisting: boolean) {
    const existingElements = eraseExisting ? [] : this.control().value || [];
    const { elements, errors } = await validateArrayElementsImport(file, delimiter, this.arrayAttribute(), existingElements);
    const modalRef = this.modalService.open(ImportArrayValidationModalComponent, { size: 'xl', backdrop: 'static' });
    modalRef.componentInstance.prepare(this.arrayAttribute(), elements, errors);
    modalRef.result.subscribe(importedElements => {
      const existing = eraseExisting ? [] : this.control().value || [];
      this.control().setValue([...existing, ...importedElements]);
    });
  }
}
