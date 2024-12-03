import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemManifest,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';

import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { Timezone } from '../../../../../backend/shared/model/types';
import { inMemoryTypeahead } from '../../shared/typeahead';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';
import { HistoryQueryDTO, HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { SouthItemTestComponent } from '../../south/south-item-test/south-item-test.component';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): Array<string>;
}

@Component({
  selector: 'oib-edit-history-query-item-modal',
  templateUrl: './edit-history-query-item-modal.component.html',
  styleUrl: './edit-history-query-item-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, FormComponent, SouthItemTestComponent]
})
export class EditHistoryQueryItemModalComponent {
  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();

  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];

  historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null = null;
  southManifest: SouthConnectorManifest | null = null;
  item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings> | null = null;
  itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>> = [];

  form: FormGroup<{
    name: FormControl<string>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  constructor(
    private modal: NgbActiveModal,
    private fb: NonNullableFormBuilder
  ) {}

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      return this.itemList
        .filter(item => item.id && item.id !== this.item?.id)
        .map(item => item.name)
        .includes(control.value)
        ? { mustBeUnique: true }
        : null;
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
    historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null,
    southManifest: SouthConnectorManifest | null
  ) {
    this.mode = 'create';
    this.itemList = itemList;
    this.historyQuery = historyQuery;
    this.southManifest = southManifest;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.southItemSchema = southItemSchema;
    this.createForm(null);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(
    southItemSchema: SouthConnectorItemManifest,
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    historyQueryItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>,
    historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null,
    southManifest: SouthConnectorManifest | null
  ) {
    this.mode = 'edit';
    this.itemList = itemList;
    this.historyQuery = historyQuery;
    this.southManifest = southManifest;
    this.item = historyQueryItem;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.southItemSchema = southItemSchema;
    this.createForm(historyQueryItem);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForCopy(
    southItemSchema: SouthConnectorItemManifest,
    southItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>,
    historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null,
    southManifest: SouthConnectorManifest | null
  ) {
    this.historyQuery = historyQuery;
    this.southManifest = southManifest;
    this.item = JSON.parse(JSON.stringify(southItem)) as HistoryQueryItemDTO<SouthItemSettings>;
    this.item.name = `${southItem.name}-copy`;
    this.mode = 'copy';
    this.southItemSchema = southItemSchema;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.createForm(this.item);
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

  get southConnectorCommand() {
    if (!this.historyQuery || !this.southManifest) {
      return null;
    }

    const command = {
      type: this.southManifest.id,
      settings: this.historyQuery.southSettings
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;

    return command;
  }
}
