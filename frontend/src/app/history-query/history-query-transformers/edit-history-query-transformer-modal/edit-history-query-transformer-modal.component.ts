import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal, NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Observable, of, switchMap } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../../backend/shared/model/transformer.model';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { ItemLightDTO, OIBusSouthType } from '../../../../../../backend/shared/model/south-connector.model';
import { getAssociatedInputType } from '../../../shared/utils/utils';
import { FormControlValidationDirective } from '../../../shared/form/form-control-validation.directive';
import { PillComponent } from '../../../shared/pill/pill.component';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../../../shared/form/typeahead';

@Component({
  selector: 'oib-edit-history-query-transformer-modal',
  templateUrl: './edit-history-query-transformer-modal.component.html',
  styleUrl: './edit-history-query-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    SaveButtonComponent,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    FormControlValidationDirective,
    NgbTypeahead,
    PillComponent
  ],
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditHistoryQueryTransformerModalComponent) => () => component.mode,
      deps: [forwardRef(() => EditHistoryQueryTransformerModalComponent)]
    }
  ]
})
export class EditHistoryQueryTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  state = new ObservableState();
  mode: 'create' | 'edit' = 'create';
  form: FormGroup<{
    transformer: FormControl<TransformerDTO | null>;
    options: FormGroup;
    itemSearch: FormControl<null | string>;
  }> = this.fb.group({
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({}),
    itemSearch: this.fb.control(null as null | string)
  });
  allTransformers: Array<TransformerDTO> = [];
  selectableOutputs: Array<TransformerDTO> = [];
  supportedOutputTypes: Array<string> = [];
  manifest: OIBusObjectAttribute | null = null;
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  existingTransformerWithOptions: TransformerDTOWithOptions | null = null;
  southType: OIBusSouthType | null = null;
  selectedItems: Array<ItemLightDTO> = [];
  selectableItems: Array<ItemLightDTO> = [];
  selectAllItems = true;
  searchResults: Array<ItemLightDTO> = [];
  totalSearchResults = 0;

  itemTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => {
        const filteredItems = this.selectableItems
          .filter(item => item.name.toLowerCase().includes(text.toLowerCase()))
          .filter(item => !this.selectedItems.some(element => element.id === item.id));
        this.searchResults = filteredItems;
        this.totalSearchResults = filteredItems.length;
        return of(filteredItems.slice(0, 10));
      })
    );
  itemFormatter = (item: ItemLightDTO) => item.name;

  prepareForCreation(
    southType: OIBusSouthType,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>,
    selectableItems: Array<ItemLightDTO>
  ) {
    this.mode = 'create';
    this.southType = southType;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.selectableItems = selectableItems;
    this.buildForm();
  }

  prepareForEdition(
    southType: OIBusSouthType,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformerWithOptionsToEdit: Omit<TransformerDTOWithOptions, 'south'>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>,
    selectableItems: Array<ItemLightDTO>
  ) {
    this.mode = 'edit';
    this.southType = southType;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.supportedOutputTypes = supportedOutputTypes;
    this.existingTransformerWithOptions = transformerWithOptionsToEdit;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.selectedItems = transformerWithOptionsToEdit.items;
    this.selectableItems = selectableItems;
    this.selectAllItems = transformerWithOptionsToEdit.items.length === 0;

    this.buildForm();
    this.createOptionsForm(transformerWithOptionsToEdit.transformer);
    // trigger rebuild of options form
    this.form!.patchValue(
      { transformer: transformerWithOptionsToEdit.transformer, options: transformerWithOptionsToEdit.options },
      { emitEvent: false }
    );
  }

  buildForm() {
    this.form.controls.transformer.valueChanges.subscribe(newTransformer => {
      if (newTransformer) {
        this.createOptionsForm(newTransformer);
      } else {
        this.form.setControl('options', this.fb.group({}));
      }
    });
    this.updateSelectableOutput(this.southType!);
  }

  createOptionsForm(newTransformer: TransformerDTO) {
    this.manifest = newTransformer.manifest;
    this.form!.setControl('options', this.fb.group({}));
    for (const attribute of this.manifest.attributes) {
      addAttributeToForm(this.fb, this.form!.controls.options, attribute);
    }
    addEnablingConditions(this.form!.controls.options, this.manifest.enablingConditions);
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form!.valid) {
      return;
    }

    this.modal.close({
      id: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.id : '',
      transformer: this.form.value.transformer,
      options: this.form!.value.options,
      inputType: getAssociatedInputType(this.southType!),
      items: this.selectAllItems ? [] : this.selectedItems
    });
  }

  compareTransformers(t1: TransformerDTO | null, t2: TransformerDTO | null): boolean {
    return t1 && t2 ? t1.id === t2.id : t1 === t2;
  }

  private updateSelectableOutput(southType: OIBusSouthType) {
    const inputType = getAssociatedInputType(southType);
    this.selectableOutputs = this.allTransformers.filter(element => {
      if (!this.supportedOutputTypes.includes(element.outputType)) {
        return false;
      }

      if (element.type === 'standard' && element.functionName === 'ignore') return true;
      if (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes.includes(element.inputType))
        return true;

      return element.inputType === inputType;
    });
  }

  selectItem(event: NgbTypeaheadSelectItemEvent<ItemLightDTO>) {
    this.selectedItems.push(event.item);
    event.preventDefault();
  }

  removeItem(itemToRemove: ItemLightDTO) {
    this.selectedItems = this.selectedItems.filter(item => item.id !== itemToRemove.id);
  }

  toggleItemSelection(selectAll: boolean) {
    this.selectAllItems = selectAll;
    if (selectAll) {
      this.selectedItems = [];
    }
  }

  selectAllResults() {
    for (const item of this.searchResults) {
      if (!this.selectedItems.some(selected => selected.id === item.id)) {
        this.selectedItems.push(item);
      }
    }
  }

  removeAllItems() {
    this.selectedItems = [];
  }
}
