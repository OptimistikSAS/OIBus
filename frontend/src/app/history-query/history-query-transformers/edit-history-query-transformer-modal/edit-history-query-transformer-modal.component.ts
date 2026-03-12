import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal, NgbDropdown, NgbDropdownAnchor, NgbDropdownItem, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
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

@Component({
  selector: 'oib-edit-history-query-transformer-modal',
  templateUrl: './edit-history-query-transformer-modal.component.html',
  styleUrl: './edit-history-query-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslateDirective,
    SaveButtonComponent,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    FormControlValidationDirective,
    NgbDropdown,
    NgbDropdownAnchor,
    NgbDropdownMenu,
    NgbDropdownItem,
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
  }> = this.fb.group({
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({})
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
  filteredItems: Array<ItemLightDTO> = [];
  totalSearchResults = 0;
  itemSearchText = '';
  searchInteracted = false;

  filterItems() {
    const matchingItems = this.selectableItems.filter(item => item.name.toLowerCase().includes(this.itemSearchText.toLowerCase()));
    this.searchResults = matchingItems.filter(item => !this.selectedItems.some(element => element.id === item.id));
    this.totalSearchResults = this.searchResults.length;
    this.filteredItems = matchingItems.slice(0, 10);
  }

  onDropdownOpenChange(isOpen: boolean) {
    if (isOpen) {
      // Items should already be pre-loaded, but just in case
      if (this.filteredItems.length === 0) {
        this.filterItems();
      }
    }
  }

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

    // Pre-load items
    this.filterItems();
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

    // Pre-load items
    this.filterItems();
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

  toggleItem(item: ItemLightDTO) {
    const index = this.selectedItems.findIndex(i => i.id === item.id);
    if (index >= 0) {
      this.selectedItems.splice(index, 1);
      if (item.name.toLowerCase().includes(this.itemSearchText.toLowerCase())) {
        this.searchResults.push(item);
      }
    } else {
      this.selectedItems.push(item);
      this.searchResults = this.searchResults.filter(i => i.id !== item.id);
    }
  }

  isItemSelected(item: ItemLightDTO): boolean {
    return this.selectedItems.some(i => i.id === item.id);
  }

  removeItem(itemToRemove: ItemLightDTO) {
    this.selectedItems = this.selectedItems.filter(item => item.id !== itemToRemove.id);
  }

  toggleItemSelection(selectAll: boolean) {
    this.selectAllItems = selectAll;
    if (selectAll) {
      this.selectedItems = [];
    }
    // Reset search interaction flag when toggling
    this.searchInteracted = false;
  }

  selectAllResults() {
    for (const item of this.searchResults) {
      if (!this.selectedItems.some(selected => selected.id === item.id)) {
        this.selectedItems.push(item);
      }
    }
    // Clear search results since all items are now selected
    this.searchResults = [];
    this.totalSearchResults = 0;
  }

  removeAllItems() {
    this.selectedItems = [];
    // Refresh search results to include previously selected items
    this.filterItems();
  }
}
