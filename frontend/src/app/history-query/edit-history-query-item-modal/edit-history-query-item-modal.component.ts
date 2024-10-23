import { Component } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorItemManifest } from '../../../../../backend/shared/model/south-connector.model';

import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { Timezone } from '../../../../../backend/shared/model/types';
import { inMemoryTypeahead } from '../../shared/typeahead';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';
import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings } from '../../../../../backend/shared/model/south-settings.model';

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
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    OibCodeBlockComponent,
    OibScanModeComponent,
    NgbTypeahead,
    FormComponent
  ],
  standalone: true
})
export class EditHistoryQueryItemModalComponent {
  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();

  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];

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
    itemList: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>
  ) {
    this.mode = 'create';
    this.itemList = itemList;
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
    historyQueryItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>
  ) {
    this.mode = 'edit';
    this.itemList = itemList;
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
    southItem: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>
  ) {
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

    this.modal.close(command);
  }
}
