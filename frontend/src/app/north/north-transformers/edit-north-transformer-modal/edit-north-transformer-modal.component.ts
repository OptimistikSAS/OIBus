import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal, NgbDropdown, NgbDropdownAnchor, NgbDropdownItem, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import {
  INPUT_TYPES,
  InputType,
  TransformerDTO,
  TransformerDTOWithOptions
} from '../../../../../../backend/shared/model/transformer.model';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { ItemLightDTO, SouthConnectorLightDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { getAssociatedInputType } from '../../../shared/utils/utils';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { FormControlValidationDirective } from '../../../shared/form/form-control-validation.directive';
import { PillComponent } from '../../../shared/pill/pill.component';

@Component({
  selector: 'oib-edit-north-transformer-modal',
  templateUrl: './edit-north-transformer-modal.component.html',
  styleUrl: './edit-north-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslateDirective,
    SaveButtonComponent,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    OIBusSouthTypeEnumPipe,
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
      useFactory: (component: EditNorthTransformerModalComponent) => () => component.mode,
      deps: [forwardRef(() => EditNorthTransformerModalComponent)]
    }
  ]
})
export class EditNorthTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private southConnectorService = inject(SouthConnectorService);

  state = new ObservableState();
  mode: 'create' | 'edit' = 'create';
  form: FormGroup<{
    source: FormControl<{ inputType: InputType | null; south: SouthConnectorLightDTO | null }>;
    transformer: FormControl<TransformerDTO | null>;
    options: FormGroup;
  }> = this.fb.group({
    source: this.fb.control<{
      inputType: InputType | null;
      south: SouthConnectorLightDTO | null;
    }>({ inputType: null, south: null }, Validators.required),
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({})
  });
  allTransformers: Array<TransformerDTO> = [];
  selectableOutputs: Array<TransformerDTO> = [];
  selectedInputs: Array<{ inputType: InputType | null; south: string | null }> = [];
  supportedOutputTypes: Array<string> = [];
  manifest: OIBusObjectAttribute | null = null;
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  southConnectors: Array<SouthConnectorLightDTO> = [];
  existingTransformerWithOptions: TransformerDTOWithOptions | null = null;
  inputTypes = INPUT_TYPES;
  selectedItems: Array<ItemLightDTO> = [];
  selectAllItems = true;
  searchResults: Array<ItemLightDTO> = [];
  filteredItems: Array<ItemLightDTO> = [];
  totalSearchResults = 0;
  itemSearchText = '';
  searchInteracted = false;

  filterItems() {
    const southId = this.form.controls.source.value.south?.id;
    if (!southId || !this.southConnectorService) {
      this.filteredItems = [];
      this.searchResults = [];
      this.totalSearchResults = 0;
      return;
    }

    const result = this.southConnectorService.searchItems(southId, { name: this.itemSearchText, page: 0 });
    if (!result) {
      this.filteredItems = [];
      this.searchResults = [];
      this.totalSearchResults = 0;
      return;
    }

    result.subscribe(items => {
      const allItems = items.content;
      this.searchResults = allItems.filter(item => !this.selectedItems.some(element => element.id === item.id));
      this.totalSearchResults = this.searchResults.length;
      this.filteredItems = allItems.slice(0, 10);
    });
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
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    selectedInputs: Array<{ inputType: InputType; south: string | null }>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'create';
    this.southConnectors = southConnectors;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.selectedInputs = selectedInputs;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.buildForm();
  }

  prepareForEdition(
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformerWithOptionsToEdit: TransformerDTOWithOptions,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'edit';
    this.southConnectors = southConnectors;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.existingTransformerWithOptions = transformerWithOptionsToEdit;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.selectedItems = transformerWithOptionsToEdit.items;
    this.selectAllItems = transformerWithOptionsToEdit.items.length === 0;

    const sourceValue = {
      inputType: transformerWithOptionsToEdit.inputType,
      south: transformerWithOptionsToEdit.south || null
    };
    this.buildForm();
    this.updateSelectableOutput(sourceValue);
    this.createOptionsForm(transformerWithOptionsToEdit.transformer);

    // trigger rebuild of options form
    this.form.patchValue(
      {
        source: sourceValue,
        transformer: transformerWithOptionsToEdit.transformer,
        options: transformerWithOptionsToEdit.options
      },
      { emitEvent: false }
    );
    this.form.controls.source.disable({ emitEvent: false });

    // Pre-load items if editing with a south connector
    if (sourceValue.south) {
      this.filterItems();
    }
  }

  buildForm() {
    this.form.controls.source.valueChanges.subscribe(source => {
      this.form.patchValue({
        transformer: null,
        options: {}
      });
      this.updateSelectableOutput(source);
      // Pre-load items when a south connector is selected
      if (source.south) {
        this.filterItems();
      } else {
        this.filteredItems = [];
        this.searchResults = [];
        this.totalSearchResults = 0;
      }
    });

    this.form.controls.transformer.valueChanges.subscribe(newTransformer => {
      if (newTransformer) {
        this.createOptionsForm(newTransformer);
      } else {
        this.form.setControl('options', this.fb.group({}));
      }
    });
  }

  createOptionsForm(newTransformer: TransformerDTO) {
    this.manifest = newTransformer.manifest;
    this.form.setControl('options', this.fb.group({}));
    for (const attribute of this.manifest.attributes) {
      addAttributeToForm(this.fb, this.form.controls.options, attribute);
    }
    addEnablingConditions(this.form.controls.options, this.manifest.enablingConditions);
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
    if (!this.form.valid) {
      return;
    }

    let south: SouthConnectorLightDTO | undefined;
    let inputType: InputType;
    if (this.existingTransformerWithOptions) {
      south = this.existingTransformerWithOptions.south || undefined;
      inputType = this.existingTransformerWithOptions.inputType;
    } else if (this.form.value.source?.south) {
      south = this.form.value.source!.south!;
      inputType = getAssociatedInputType(south.type);
    } else {
      south = undefined;
      inputType = this.form.value.source!.inputType!;
    }
    this.modal.close({
      id: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.id : '',
      transformer: this.form.value.transformer,
      options: this.form.value.options,
      south: south,
      inputType: inputType,
      items: this.selectAllItems ? [] : this.selectedItems
    });
  }

  inputTypeIsSelected(inputType: string) {
    return this.selectedInputs.map(input => input.inputType).includes(inputType);
  }

  compareSource(o1: any, o2: any): boolean {
    if (!o1 || !o2) return o1 === o2;
    // Compare Input Types
    if (o1.inputType !== o2.inputType) return false;
    // Compare South Connectors (handle objects or nulls)
    const southId1 = o1.south?.id || o1.south; // handle if south is just ID or full object
    const southId2 = o2.south?.id || o2.south;
    return southId1 === southId2;
  }

  compareTransformers(t1: TransformerDTO | null, t2: TransformerDTO | null): boolean {
    return t1 && t2 ? t1.id === t2.id : t1 === t2;
  }

  private updateSelectableOutput(source: { inputType: InputType | null; south: SouthConnectorLightDTO | null }) {
    this.selectableOutputs = this.allTransformers.filter(element => {
      if (!this.supportedOutputTypes.includes(element.outputType)) {
        return false;
      }

      if (element.type === 'standard' && element.functionName === 'ignore') return true;
      if (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes.includes(element.inputType))
        return true;

      if (source.inputType) {
        return element.inputType === source.inputType;
      } else if (source.south) {
        return element.inputType === getAssociatedInputType(source.south.type);
      }

      return true;
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
