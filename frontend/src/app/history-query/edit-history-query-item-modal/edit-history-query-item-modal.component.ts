import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemManifest,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';

import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';
import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { SouthItemTestComponent } from '../../south/south-item-test/south-item-test.component';
import { Observable } from 'rxjs';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-history-query-item-modal',
  templateUrl: './edit-history-query-item-modal.component.html',
  styleUrl: './edit-history-query-item-modal.component.scss',
  imports: [...formDirectives, TranslateDirective, SaveButtonComponent, FormComponent, SouthItemTestComponent]
})
export class EditHistoryQueryItemModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();

  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];

  historyId!: string;
  southConnectorCommand!: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
  southManifest!: SouthConnectorManifest;
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

  private createForm(item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings> | null) {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      enabled: [true, Validators.required],
      settings: createFormGroup(this.southItemSchema!.settings, this.fb)
    });

    // if we have an item we initialize the values
    if (item) {
      this.form.patchValue(item);
    } else {
      this.form.setValue(this.form.getRawValue());
    }
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(
    southItemSchema: SouthConnectorItemManifest,
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    historyId: string,
    southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    southManifest: SouthConnectorManifest
  ) {
    this.mode = 'create';
    this.itemList = itemList;
    this.historyId = historyId;
    this.southConnectorCommand = southConnectorCommand;
    this.southManifest = southManifest;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.southItemSchema = southItemSchema;
    this.createForm(null);
  }

  /**
   * Prepares the component for edition.
   * @param tableIndex an additional identifier, when item ids are not available. This indexes the given itemList param
   */
  prepareForEdition(
    southItemSchema: SouthConnectorItemManifest,
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    historyQueryItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>,
    historyId: string,
    southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    southManifest: SouthConnectorManifest,
    tableIndex: number
  ) {
    this.mode = 'edit';
    this.itemList = itemList;
    this.historyId = historyId;
    this.southConnectorCommand = southConnectorCommand;
    this.southManifest = southManifest;
    this.item = historyQueryItem;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.southItemSchema = southItemSchema;
    this.createForm(historyQueryItem);
    this.tableIndex = tableIndex;
  }

  /**
   * Prepares the component for edition.
   */
  prepareForCopy(
    southItemSchema: SouthConnectorItemManifest,
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    southItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>,
    historyId: string,
    southConnectorCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    southManifest: SouthConnectorManifest
  ) {
    this.historyId = historyId;
    this.southConnectorCommand = southConnectorCommand;
    this.southManifest = southManifest;
    this.item = JSON.parse(JSON.stringify(southItem)) as HistoryQueryItemDTO<SouthItemSettings>;
    this.item.name = `${southItem.name}-copy`;
    this.mode = 'copy';
    this.itemList = itemList;
    this.southItemSchema = southItemSchema;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.createForm(this.item);
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

  get formItem() {
    const formValue = this.form!.value;
    let id: string | null = null;
    if (this.mode === 'edit') {
      id = this.item?.id || null;
    }

    const command: HistoryQueryItemCommandDTO<SouthItemSettings> = {
      id,
      enabled: formValue.enabled!,
      name: formValue.name!,
      settings: formValue.settings!
    };

    return command;
  }
}
