import { Component, computed, inject, input, output } from '@angular/core';
import { ControlContainer, FormControl, FormGroup, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { OIBusArrayAttribute, OIBusAttributeType } from '../../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../../box/box.component';
import { PaginationComponent } from '../../../pagination/pagination.component';
import { ModalService } from '../../../modal.service';
import type { Modal } from '../../../modal.service';
import { ArrayPage } from '../../../pagination/array-page';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';
import { ValErrorDelayDirective } from '../../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { FormUtils } from '../../form-utils';
import type { ManifestAttributeEditorModalComponent } from '../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component';

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
  contextPath = input<Array<string>>([]);

  // Emit when nested data changes (for parent modals to react)
  nestedChange = output<void>();

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
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForCreation(this.scanModes(), this.certificates(), this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  async copyItem(element: any) {
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForEdition(
      this.scanModes(),
      this.certificates(),
      { ...element, key: element.key + '_copy' },
      this.contextPath(),
      depth
    );

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  async editItem(element: any) {
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForEdition(this.scanModes(), this.certificates(), element, this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      const newArray = [...this.control().value];
      const index = this.control().value.indexOf(element);
      newArray[index] = { ...arrayElement, id: element.id };

      this.control().setValue(newArray);
      this.paginatedValues().gotoPage(0);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  deleteItem(element: any) {
    const newArray = [...this.control().value];
    const index = this.control().value.indexOf(element);
    newArray.splice(index, 1);
    this.control().setValue(newArray);
    this.paginatedValues().gotoPage(0);
    this.control().markAsDirty();
    this.nestedChange.emit();
  }

  formatValue(element: any, path: Array<string>, type: OIBusAttributeType, translationKey: string) {
    return FormUtils.formatValue(element, path, type, translationKey, this.translateService, this.scanModes());
  }

  private async openAttributeEditor(): Promise<Modal<ManifestAttributeEditorModalComponent>> {
    const { ManifestAttributeEditorModalComponent } = await import(
      '../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component'
    );
    return this.modalService.open<ManifestAttributeEditorModalComponent>(ManifestAttributeEditorModalComponent, {
      size: 'lg'
    });
  }
}
