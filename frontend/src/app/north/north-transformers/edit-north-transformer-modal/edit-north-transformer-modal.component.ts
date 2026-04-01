import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal, NgbDropdown, NgbDropdownAnchor, NgbDropdownItem, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import {
  DataSourceType,
  SourceOriginSouthDTO,
  TransformerDTO,
  TransformerDTOWithOptions,
  TransformerSourceDTO
} from '../../../../../../backend/shared/model/transformer.model';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import {
  ItemLightDTO,
  SouthConnectorLightDTO,
  SouthItemGroupDTO,
  SouthItemGroupLightDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { getAssociatedInputType } from '../../../shared/utils/utils';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { FormControlValidationDirective } from '../../../shared/form/form-control-validation.directive';
import { PillComponent } from '../../../shared/pill/pill.component';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';

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
    PillComponent,
    ValErrorDelayDirective,
    ValidationErrorsComponent
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
    source: FormControl<{
      dataSourceType: DataSourceType | null;
      south: SouthConnectorLightDTO | null;
    }>;
    apiDataSourceId: FormControl<string | null>;
    transformer: FormControl<TransformerDTO | null>;
    options: FormGroup;
  }> = this.fb.group({
    source: this.fb.control<{
      dataSourceType: DataSourceType | null;
      south: SouthConnectorLightDTO | null;
    }>(
      {
        dataSourceType: null,
        south: null
      },
      Validators.required
    ),
    apiDataSourceId: this.fb.control<string | null>(null),
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({})
  });
  allTransformers: Array<TransformerDTO> = [];
  selectableOutputs: Array<TransformerDTO> = [];
  supportedOutputTypes: Array<string> = [];
  manifest: OIBusObjectAttribute | null = null;
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  southConnectors: Array<SouthConnectorLightDTO> = [];
  existingTransformerWithOptions: TransformerDTOWithOptions | null = null;

  selectedItems: Array<ItemLightDTO> = [];
  selectionType: 'all' | 'group' | 'items' = 'all';
  searchResults: Array<ItemLightDTO> = [];
  filteredItems: Array<ItemLightDTO> = [];
  totalSearchResults = 0;
  itemSearchText = '';
  searchInteracted = false;
  availableGroups: Array<SouthItemGroupDTO> = [];
  selectedGroup: SouthItemGroupLightDTO | null = null;

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
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'create';
    this.southConnectors = southConnectors;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.buildForm();
  }

  prepareForEdition(
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>,
    transformerWithOptionsToEdit: TransformerDTOWithOptions
  ) {
    this.mode = 'edit';
    this.southConnectors = southConnectors;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.existingTransformerWithOptions = transformerWithOptionsToEdit;
    this.selectedItems = [];
    if (transformerWithOptionsToEdit.source.type === 'south') {
      this.filterItems();
      // Pre-load items and groups if editing with a south connector
      this.southConnectorService.getGroups(transformerWithOptionsToEdit.source.south.id).subscribe(groups => {
        this.availableGroups = groups;
      });
      this.selectedItems = transformerWithOptionsToEdit.source.items;
      if (transformerWithOptionsToEdit.source.group) {
        this.selectionType = 'group';
        this.selectedGroup = transformerWithOptionsToEdit.source.group;
      } else if (this.selectedItems.length > 0) {
        this.selectionType = 'items';
      } else {
        this.selectionType = 'all';
      }
    }

    const sourceValue = {
      dataSourceType: transformerWithOptionsToEdit.source.type,
      south: transformerWithOptionsToEdit.source.type === 'south' ? (transformerWithOptionsToEdit.source.south ?? null) : null
    };
    this.buildForm();
    this.updateSelectableOutput(sourceValue);
    this.createOptionsForm(transformerWithOptionsToEdit.transformer);

    // trigger rebuild of options form
    this.form.patchValue(
      {
        source: sourceValue,
        apiDataSourceId: transformerWithOptionsToEdit.source.type === 'oibus-api' ? transformerWithOptionsToEdit.source.dataSourceId : null,
        transformer: transformerWithOptionsToEdit.transformer,
        options: transformerWithOptionsToEdit.options
      },
      { emitEvent: false }
    );
    this.form.controls.source.disable({ emitEvent: false });
  }

  buildForm() {
    this.form.controls.source.valueChanges.subscribe(source => {
      this.form.patchValue({
        transformer: null,
        options: {}
      });
      this.updateSelectableOutput(source);
      this.selectionType = 'all';
      this.selectedGroup = null;
      this.availableGroups = [];
      if (source.south) {
        this.filterItems();
        this.southConnectorService.getGroups(source.south.id).subscribe(groups => {
          this.availableGroups = groups;
        });
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

    const sourceType: DataSourceType = (
      this.existingTransformerWithOptions ? this.existingTransformerWithOptions.source.type : this.form.value.source!.dataSourceType!
    ) as DataSourceType;
    let source: TransformerSourceDTO;
    if (sourceType === 'south') {
      source = {
        type: 'south',
        south: this.existingTransformerWithOptions
          ? (this.existingTransformerWithOptions.source as SourceOriginSouthDTO).south
          : this.form.value.source!.south!,
        group: this.selectionType === 'group' && this.selectedGroup ? this.selectedGroup : undefined,
        items: this.selectionType === 'items' ? this.selectedItems.map(item => ({ id: item.id, name: item.name, createdBy: item.createdBy, updatedBy: item.updatedBy, createdAt: item.createdAt, updatedAt: item.updatedAt })) : []
      };
    } else if (sourceType === 'oibus-api') {
      source = { type: 'oibus-api', dataSourceId: this.form.value.apiDataSourceId! };
    } else {
      source = { type: 'oianalytics-setpoint' };
    }

    this.modal.close({
      id: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.id : '',
      source,
      transformer: this.form.value.transformer,
      options: this.form.value.options
    });
  }

  compareSource(o1: any, o2: any): boolean {
    if (!o1 || !o2) return o1 === o2;
    // Compare Input Types
    if (o1.dataSourceType !== o2.dataSourceType) return false;
    // Compare South Connectors (handle objects or nulls)
    const southId1 = o1.south?.id || o1.south; // handle if south is just ID or full object
    const southId2 = o2.south?.id || o2.south;
    return southId1 === southId2;
  }

  compareTransformers(t1: TransformerDTO | null, t2: TransformerDTO | null): boolean {
    return t1 && t2 ? t1.id === t2.id : t1 === t2;
  }

  compareGroups(g1: SouthItemGroupLightDTO | null, g2: SouthItemGroupLightDTO | null): boolean {
    return g1 && g2 ? g1.id === g2.id : g1 === g2;
  }

  private updateSelectableOutput(source: { dataSourceType: DataSourceType | null; south: SouthConnectorLightDTO | null }) {
    this.selectableOutputs = this.allTransformers.filter(element => {
      if (!this.supportedOutputTypes.includes(element.outputType)) {
        return false;
      }

      if (element.type === 'standard' && element.functionName === 'ignore') return true;
      if (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes.includes(element.inputType))
        return true;

      if (source.dataSourceType === 'oianalytics-setpoint') {
        return element.inputType === 'setpoint';
      }

      if (source.dataSourceType === 'south' && source.south) {
        return element.inputType === 'any' || element.inputType === getAssociatedInputType(source.south.type);
      }

      if (source.dataSourceType === 'oibus-api') {
        return element.inputType === 'any';
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

  setSelectionType(type: 'all' | 'group' | 'items') {
    this.selectionType = type;
    if (type !== 'items') {
      this.selectedItems = [];
      this.searchInteracted = false;
      this.searchResults = [];
      this.filteredItems = [];
      this.totalSearchResults = 0;
    } else {
      this.filterItems();
    }
    if (type !== 'group') {
      this.selectedGroup = null;
    }
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
