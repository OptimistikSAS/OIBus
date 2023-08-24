import { Component } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemManifest
} from '../../../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { NgForOf, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { Timezone } from '../../../../../shared/model/types';
import { inMemoryTypeahead } from '../../shared/typeahead';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { FormComponent } from '../../shared/form/form.component';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}

@Component({
  selector: 'oib-edit-south-item-modal',
  templateUrl: './edit-south-item-modal.component.html',
  styleUrls: ['./edit-south-item-modal.component.scss'],
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    NgSwitch,
    NgSwitchCase,
    NgIf,
    OibCodeBlockComponent,
    OibScanModeComponent,
    NgbTypeahead,
    FormComponent
  ],
  standalone: true
})
export class EditSouthItemModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  subscriptionOnly = false;
  acceptSubscription = false;

  scanModes: Array<ScanModeDTO> = [];
  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];

  item: SouthConnectorItemDTO | null = null;

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

  constructor(private modal: NgbActiveModal, private fb: NonNullableFormBuilder) {}

  private createForm(item: SouthConnectorItemDTO | null) {
    this.form = this.fb.group({
      name: ['', Validators.required],
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
  prepareForCreation(southItemSchema: SouthConnectorItemManifest, scanModes: Array<ScanModeDTO>) {
    this.mode = 'create';
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
  prepareForEdition(southItemSchema: SouthConnectorItemManifest, scanModes: Array<ScanModeDTO>, southItem: SouthConnectorItemDTO) {
    this.mode = 'edit';
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
  prepareForCopy(southItemSchema: SouthConnectorItemManifest, scanModes: Array<ScanModeDTO>, southItem: SouthConnectorItemDTO) {
    this.item = JSON.parse(JSON.stringify(southItem)) as SouthConnectorItemDTO;
    this.item.name = `${southItem.name}-copy`;
    this.mode = 'create';
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

    const formValue = this.form!.value;

    const command: SouthConnectorItemCommandDTO = {
      id: this.item ? this.item.id : undefined,
      enabled: formValue.enabled!,
      name: formValue.name!,
      scanModeId: this.subscriptionOnly ? 'subscription' : formValue.scanModeId!,
      settings: formValue.settings!
    };

    this.modal.close(command);
  }
}
