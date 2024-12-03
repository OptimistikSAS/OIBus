import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemManifest,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';

import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { Timezone } from '../../../../../backend/shared/model/types';
import { inMemoryTypeahead } from '../../shared/typeahead';
import { OibFormControl } from '../../../../../backend/shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { SouthItemTestComponent } from '../south-item-test/south-item-test.component';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): Array<string>;
}

@Component({
  selector: 'oib-edit-south-item-modal',
  templateUrl: './edit-south-item-modal.component.html',
  styleUrl: './edit-south-item-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, OibScanModeComponent, FormComponent, SouthItemTestComponent]
})
export class EditSouthItemModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);

  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();
  subscriptionOnly = false;
  acceptSubscription = false;

  scanModes: Array<ScanModeDTO> = [];
  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];

  southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null = null;
  southManifest: SouthConnectorManifest | null = null;
  item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings> | null = null;
  itemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>> = [];

  form: FormGroup<{
    name: FormControl<string>;
    scanModeId: FormControl<string | null>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

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

  private createForm(item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings> | null) {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      enabled: [true, Validators.required],
      scanModeId: this.fb.control<string | null>(null, Validators.required),
      settings: createFormGroup(this.southItemSchema!.settings, this.fb)
    });

    if (this.subscriptionOnly) {
      this.form.controls.scanModeId.disable();
    } else {
      this.form.controls.scanModeId.enable();
    }

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
    itemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>,
    scanModes: Array<ScanModeDTO>,
    southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null,
    southManifest: SouthConnectorManifest | null
  ) {
    this.mode = 'create';
    this.itemList = itemList;
    this.southConnector = southConnector;
    this.southManifest = southManifest;
    this.subscriptionOnly = southItemSchema.scanMode.subscriptionOnly;
    this.acceptSubscription = southItemSchema.scanMode.acceptSubscription;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.southItemSchema = southItemSchema;
    this.scanModes = scanModes;
    this.createForm(null);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(
    southItemSchema: SouthConnectorItemManifest,
    itemList: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>,
    scanModes: Array<ScanModeDTO>,
    southItem: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>,
    southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null,
    southManifest: SouthConnectorManifest | null
  ) {
    this.mode = 'edit';
    this.itemList = itemList;
    this.southConnector = southConnector;
    this.southManifest = southManifest;
    this.item = southItem;
    this.subscriptionOnly = southItemSchema.scanMode.subscriptionOnly;
    this.acceptSubscription = southItemSchema.scanMode.acceptSubscription;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.southItemSchema = southItemSchema;
    this.scanModes = scanModes;
    this.createForm(southItem);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForCopy(
    southItemSchema: SouthConnectorItemManifest,
    scanModes: Array<ScanModeDTO>,
    southItem: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>,
    southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null,
    southManifest: SouthConnectorManifest | null
  ) {
    this.southConnector = southConnector;
    this.southManifest = southManifest;
    this.item = JSON.parse(JSON.stringify(southItem)) as SouthConnectorItemDTO<SouthItemSettings>;
    this.item.name = `${southItem.name}-copy`;
    this.mode = 'copy';
    this.subscriptionOnly = southItemSchema.scanMode.subscriptionOnly;
    this.acceptSubscription = southItemSchema.scanMode.acceptSubscription;
    this.southItemSchema = southItemSchema;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.scanModes = scanModes;
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

  get formItem(): SouthConnectorItemCommandDTO<SouthItemSettings> {
    const formValue = this.form!.value;
    let id: string | null = null;
    if (this.mode === 'edit') {
      id = this.item?.id || null;
    }

    const command: SouthConnectorItemCommandDTO<SouthItemSettings> = {
      id,
      enabled: formValue.enabled!,
      name: formValue.name!,
      scanModeId: this.subscriptionOnly ? 'subscription' : formValue.scanModeId!,
      scanModeName: null,
      settings: formValue.settings!
    };

    return command;
  }

  get southConnectorCommand() {
    if (!this.southConnector) {
      return null;
    }

    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      ...this.southConnector,
      items: this.southConnector.items.map(i => ({ ...i, scanModeName: null }))
    };

    return command;
  }
}
