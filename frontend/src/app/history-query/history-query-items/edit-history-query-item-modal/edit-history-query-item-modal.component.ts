import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { Observable } from 'rxjs';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { SouthItemTestComponent } from '../../../south/south-items/south-item-test/south-item-test.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { SouthItemSettings, SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../../backend/shared/model/history-query.model';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';

@Component({
  selector: 'oib-edit-history-query-item-modal',
  templateUrl: './edit-history-query-item-modal.component.html',
  styleUrl: './edit-history-query-item-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    SouthItemTestComponent,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    SaveButtonComponent
  ]
})
export class EditHistoryQueryItemModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();
  historyId!: string;
  southConnectorCommand!: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
  manifest!: SouthConnectorManifest;
  item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings> | null = null;
  itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> = [];

  /** Not every item passed will have an id, but we still need to check for uniqueness.
   * This ensures that we have a backup identifier for the currently edited item.
   * In 'copy' and 'create' cases, we always check all items' names
   */
  tableIndex: number | null = null;

  form: FormGroup<{
    name: FormControl<string>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    historyId: string,
    southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    manifest: SouthConnectorManifest
  ) {
    this.mode = 'create';
    this.manifest = manifest;
    this.historyId = historyId;
    this.southConnectorCommand = southConnectorCommand;
    this.itemList = itemList;
    this.buildForm();
  }

  prepareForEdition(
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    historyQueryItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>,
    historyId: string,
    southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    manifest: SouthConnectorManifest,
    tableIndex: number
  ) {
    this.mode = 'edit';
    this.manifest = manifest;
    this.historyId = historyId;
    this.southConnectorCommand = southConnectorCommand;
    this.itemList = itemList;
    this.item = historyQueryItem; // used to check uniqueness
    this.tableIndex = tableIndex;
    this.buildForm();
  }

  prepareForCopy(
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>,
    historyId: string,
    southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    manifest: SouthConnectorManifest
  ) {
    this.mode = 'copy';
    this.manifest = manifest;
    this.historyId = historyId;
    this.southConnectorCommand = southConnectorCommand;
    this.itemList = itemList;
    // used to check uniqueness
    this.item = JSON.parse(JSON.stringify(item)) as HistoryQueryItemDTO<SouthItemSettings>;
    this.item.name = `${item.name}-copy`;
    this.item.id = '';
    this.buildForm();
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
    this.modal.close(this.formItem);
  }

  get formItem(): HistoryQueryItemDTO<SouthItemSettings> {
    const formValue = this.form!.value;

    return {
      id: this.item?.id || '',
      enabled: formValue.enabled!,
      name: formValue.name!,
      settings: formValue.settings!
    };
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let names!: Array<string>;

      switch (this.mode) {
        case 'copy':
        case 'create':
          names = this.itemList.map(item => item.name);
          break;
        case 'edit':
          if (this.item!.id) {
            names = this.itemList.filter(item => item.id && item.id !== this.item?.id).map(item => item.name);
          }
          names = this.itemList.filter((_, index) => index !== this.tableIndex).map(item => item.name);
          break;
      }

      return names.includes(control.value) ? { mustBeUnique: true } : null;
    };
  }

  private buildForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      enabled: [true, Validators.required],
      settings: this.fb.group({})
    });

    const settingsAttribute = this.getItemSettingsAttribute();
    for (const attribute of settingsAttribute.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    addEnablingConditions(this.form.controls.settings, settingsAttribute.enablingConditions);

    // if we have an item, we initialize the values
    if (this.item) {
      this.form.patchValue(this.item);
    } else {
      this.form.setValue(this.form.getRawValue());
    }
  }

  getItemSettingsAttribute(): OIBusObjectAttribute {
    return this.manifest.items.rootAttribute.attributes.find(element => element.key === 'settings')! as OIBusObjectAttribute;
  }
}
