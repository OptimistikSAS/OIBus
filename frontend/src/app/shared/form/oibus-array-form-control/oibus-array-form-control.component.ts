import { Component, computed, inject, input } from '@angular/core';
import { ControlContainer, FormControl, FormGroup, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { OIBusArrayAttribute, OIBusAttributeType, OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';
import { PaginationComponent } from '../../pagination/pagination.component';
import { ModalService } from '../../modal.service';
import { ArrayPage } from '../../pagination/array-page';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal/oibus-edit-array-element-modal.component';
import { isDisplayableAttribute } from '../dynamic-form.builder';
import { ValErrorDelayDirective } from '../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ExportItemModalComponent } from '../../export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../import-item-modal/import-item-modal.component';
import { NotificationService } from '../../notification.service';
import { ImportArrayValidationModalComponent } from './import-array-validation-modal/import-array-validation-modal.component';
import { Modal } from '../../modal.service';
import { SouthConnectorService } from '../../../services/south-connector.service';

interface Column {
  path: Array<string>;
  type: OIBusAttributeType;
  translationKey: string;
}

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
  private southConnectorService = inject(SouthConnectorService);
  private notificationService = inject(NotificationService);

  scanModes = input.required<Array<ScanModeDTO>>();
  certificates = input.required<Array<CertificateDTO>>();
  parentGroup = input.required<FormGroup>();
  control = input.required<FormControl<Array<any>>>();
  arrayAttribute = input.required<OIBusArrayAttribute>();
  southId = input<string>();

  private readonly controlValue = toSignal(toObservable(this.control).pipe(switchMap(c => c.valueChanges.pipe(startWith(c.value)))));
  readonly columns = computed(() => this.buildColumn(this.arrayAttribute().rootAttribute, []));
  readonly paginatedValues = computed(() => {
    if (this.arrayAttribute().paginate) {
      return new ArrayPage(this.controlValue()!, this.arrayAttribute().numberOfElementPerPage);
    }
    return new ArrayPage([], 1);
  });

  async addElement(event: Event) {
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

  async copyElement(element: any) {
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

  async editElement(element: any) {
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

  buildColumn(attribute: OIBusObjectAttribute, prefix: Array<string>): Array<Column> {
    return attribute.attributes
      .filter(
        attribute => attribute.type === 'object' || (isDisplayableAttribute(attribute) && attribute.displayProperties.displayInViewMode)
      )
      .map(attribute => {
        switch (attribute.type) {
          case 'scan-mode':
          case 'certificate':
          case 'timezone':
          case 'boolean':
          case 'instant':
          case 'number':
          case 'secret':
          case 'string':
          case 'code':
          case 'string-select':
            return [{ path: [...prefix, attribute.key], type: attribute.type, translationKey: attribute.translationKey }];
          case 'object':
            return this.buildColumn(attribute, [...prefix, attribute.key]);
          case 'array':
            return [];
        }
      })
      .flat();
  }

  formatValue(element: any, path: Array<string>, type: OIBusAttributeType, translationKey: string) {
    const value = this.getValueByPath(element, path);
    if (value === undefined) {
      return '';
    }
    switch (type) {
      case 'object':
      case 'array':
        return '';
      case 'string-select':
        return this.translateService.instant(`${translationKey}.${value}`);
      case 'number':
      case 'code':
      case 'string':
      case 'timezone':
      case 'instant':
        return value;
      case 'boolean':
        return this.translateService.instant(`enums.boolean.${value}`);
      case 'scan-mode':
        return this.scanModes().find(scanMode => scanMode.id === value)?.name;
    }
  }

  getValueByPath(obj: any, path: Array<string>) {
    return path.reduce((acc, key) => acc && acc[key], obj);
  }

  async exportArray() {
    const modal = this.modalService.open(ExportItemModalComponent);
    modal.componentInstance.prepare(this.arrayAttribute().key);

    modal.result.subscribe(result => {
      if (result) {
        const southId = this.southId();
        const southType = this.resolveSouthType();
        const arrayKey = this.arrayAttribute().key;
        const delimiter = result.delimiter;
        const elements = this.control().value || [];

        if (!southId) {
          this.notificationService.error('common.export-error');
          return;
        }

        if (southId === 'create') {
          if (!southType) {
            this.notificationService.error('common.export-error');
            return;
          }
          this.southConnectorService.arrayToCsv(southType, arrayKey, elements, delimiter).subscribe({
            next: () => this.notificationService.success('common.export-success'),
            error: () => this.notificationService.error('common.export-error')
          });
        } else {
          this.southConnectorService.exportArray(southId, arrayKey, delimiter).subscribe({
            next: () => this.notificationService.success('common.export-success'),
            error: () => this.notificationService.error('common.export-error')
          });
        }
      }
    });
  }

  async importArray() {
    const modal = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });

    modal.componentInstance.expectedHeaders = this.getExpectedHeaders();
    modal.componentInstance.optionalHeaders = [];

    modal.result.subscribe(response => {
      if (!response) return;
      this.checkImportArray(response.file, response.delimiter);
    });
  }

  private getExpectedHeaders(): Array<string> {
    const headers: Array<string> = [];

    if (this.arrayAttribute().rootAttribute.attributes) {
      this.arrayAttribute().rootAttribute.attributes.forEach(attr => {
        if (attr.type === 'object' && 'attributes' in attr) {
          // For nested objects, prefix with the attribute key
          attr.attributes.forEach(subAttr => {
            headers.push(`${attr.key}_${subAttr.key}`);
          });
        } else {
          headers.push(attr.key);
        }
      });
    }

    return headers;
  }

  private checkImportArray(file: File, delimiter: string) {
    const southId = this.southId()!;
    const southType = southId === 'create' ? this.resolveSouthType() : undefined;

    if (southId === 'create' && !southType) {
      this.notificationService.error('common.import-error');
      return;
    }

    this.southConnectorService
      .checkImportArray(southId, this.arrayAttribute().key, file, delimiter, this.control().value || [], southType)
      .subscribe({
        next: response => {
          const modalRef = this.modalService.open(ImportArrayValidationModalComponent, { size: 'xl', backdrop: 'static' });
          const component: ImportArrayValidationModalComponent = modalRef.componentInstance;
          component.prepare(this.arrayAttribute(), response.elements, response.errors);
          this.refreshAfterImportModalClosed(modalRef);
        },
        error: () => {
          this.notificationService.error('common.import-error');
        }
      });
  }

  /**
   * Refresh the array values when items are imported
   */
  private refreshAfterImportModalClosed(modalRef: Modal<ImportArrayValidationModalComponent>) {
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

  private resolveSouthType(): string | undefined {
    const rootGroup = this.parentGroup().root as FormGroup | undefined;
    return rootGroup?.get('type')?.value;
  }
}
