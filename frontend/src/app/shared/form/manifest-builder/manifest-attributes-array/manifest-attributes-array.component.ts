import { Component, computed, inject, input } from '@angular/core';
import { ControlContainer, FormControl, FormGroup, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { OIBusArrayAttribute, OIBusAttributeType } from '../../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../../box/box.component';
import { PaginationComponent } from '../../../pagination/pagination.component';
import { ModalService } from '../../../modal.service';
import { ArrayPage } from '../../../pagination/array-page';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';
import { ManifestAttributeEditorModalComponent } from '../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component';
import { ValErrorDelayDirective } from '../../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { FormUtils } from '../../form-utils';

@Component({
  selector: 'oib-manifest-attributes-array',
  templateUrl: './manifest-attributes-array.component.html',
  styleUrl: './manifest-attributes-array.component.scss',
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
export class ManifestAttributesArrayComponent {
  private modalService = inject(ModalService);
  private translateService = inject(TranslateService);

  scanModes = input.required<Array<ScanModeDTO>>();
  certificates = input.required<Array<CertificateDTO>>();
  parentGroup = input.required<FormGroup>();
  control = input.required<FormControl<Array<any>>>();
  arrayAttribute = input.required<OIBusArrayAttribute>();

  private readonly controlValue = toSignal(toObservable(this.control).pipe(switchMap(c => c.valueChanges.pipe(startWith(c.value)))));
  readonly columns = computed(() => FormUtils.buildColumn(this.arrayAttribute().rootAttribute, []));
  readonly paginatedValues = computed(() => {
    if (this.arrayAttribute().paginate) {
      return new ArrayPage(this.controlValue()!, this.arrayAttribute().numberOfElementPerPage);
    }
    return new ArrayPage([], 1);
  });

  async addItem(event: Event) {
    event.preventDefault();
    const modal = this.modalService.open(ManifestAttributeEditorModalComponent, { size: 'lg' });
    modal.componentInstance.prepareForCreation(this.scanModes(), this.certificates());

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
    });
  }

  async copyItem(element: any) {
    const modal = this.modalService.open(ManifestAttributeEditorModalComponent, { size: 'lg' });
    modal.componentInstance.prepareForCreation(this.scanModes(), this.certificates());

    // Pre-populate with the copied attribute's values
    const copiedAttribute = { ...element, key: element.key + '_copy' };
    modal.componentInstance.prepareForEdition(this.scanModes(), this.certificates(), copiedAttribute);

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
    });
  }

  async editItem(element: any) {
    const modal = this.modalService.open(ManifestAttributeEditorModalComponent, { size: 'lg' });
    modal.componentInstance.prepareForEdition(this.scanModes(), this.certificates(), element);

    modal.result.subscribe(arrayElement => {
      const newArray = [...this.control().value];
      const index = this.control().value.indexOf(element);
      newArray[index] = { ...arrayElement, id: element.id };

      this.control().setValue(newArray);
      this.paginatedValues().gotoPage(0);
    });
  }

  deleteItem(element: any) {
    const newArray = [...this.control().value];
    const index = this.control().value.indexOf(element);
    newArray.splice(index, 1);
    this.control().setValue(newArray);
    this.paginatedValues().gotoPage(0);
  }

  formatValue(element: any, path: Array<string>, type: OIBusAttributeType, translationKey: string) {
    return FormUtils.formatValue(element, path, type, translationKey, this.translateService, this.scanModes());
  }

  getValueByPath(obj: any, path: Array<string>) {
    return FormUtils.getValueByPath(obj, path);
  }
}
