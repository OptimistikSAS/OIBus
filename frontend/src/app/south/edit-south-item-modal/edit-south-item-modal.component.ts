import { Component } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorDTO, OibusItemCommandDTO, OibusItemDTO, OibusItemManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { NgForOf, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { createInput } from '../../shared/utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { Timezone } from '../../../../../shared/model/types';
import { inMemoryTypeahead } from '../../shared/typeahead';

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
    NgbTypeahead
  ],
  standalone: true
})
export class EditSouthItemModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  southConnector: SouthConnectorDTO | null = null;
  southItemSchema: OibusItemManifest | null = null;
  item: OibusItemDTO | null = null;
  scanModes: Array<ScanModeDTO> = [];
  form = this.fb.group({
    name: ['', Validators.required],
    scanMode: [null as ScanModeDTO | null, Validators.required],
    settings: this.fb.record({})
  });

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private southConnectorService: SouthConnectorService) {}

  private createSettingsInputs() {
    const inputsToSubscribeTo: Set<string> = new Set();
    const settingsForm = this.form.controls.settings;
    this.southItemSchema!.settings.forEach(row => {
      createInput(row, settingsForm);
      if (row.conditionalDisplay) {
        Object.entries(row.conditionalDisplay).forEach(([key]) => {
          // Keep only one occurrence of each input to subscribe to
          inputsToSubscribeTo.add(key);
        });
      }
    });
    // Each input that must be monitored is subscribed
    inputsToSubscribeTo.forEach(input => {
      // Check once with initialized value
      this.disableInputs(input, settingsForm.controls[input].value as string | number | boolean, settingsForm);
      // Check on value changes
      settingsForm.controls[input].valueChanges.subscribe(inputValue => {
        // When a value of such an input changes, check if its inputValue implies to disable another input
        this.disableInputs(input, inputValue as string | number | boolean, settingsForm);
      });
    });

    if (this.southItemSchema!.scanMode.subscriptionOnly) {
      this.form.controls.scanMode.disable();
    } else {
      this.form.controls.scanMode.enable();
    }
  }

  private disableInputs(input: string, inputValue: string | number | boolean, settingsForm: FormGroup) {
    this.southItemSchema!.settings.forEach(row => {
      if (row.conditionalDisplay) {
        Object.entries(row.conditionalDisplay).forEach(([key, values]) => {
          if (key === input) {
            if (!values.includes(inputValue)) {
              settingsForm.controls[row.key].disable();
            } else {
              settingsForm.controls[row.key].enable();
            }
          }
        });
      }
    });
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(southConnector: SouthConnectorDTO, southItemSchema: OibusItemManifest, scanModes: Array<ScanModeDTO>) {
    this.mode = 'create';
    this.southConnector = southConnector;
    this.southItemSchema = southItemSchema;
    this.scanModes = scanModes;

    this.createSettingsInputs();
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(
    southConnector: SouthConnectorDTO,
    southItemSchema: OibusItemManifest,
    scanModes: Array<ScanModeDTO>,
    southItem: OibusItemDTO
  ) {
    this.mode = 'edit';
    this.item = southItem;
    this.southConnector = southConnector;
    this.southItemSchema = southItemSchema;
    this.scanModes = scanModes;

    this.southItemSchema.settings.forEach(element => {
      if (this.item?.settings) {
        element.currentValue = this.item.settings[element.key];
      }
    });

    this.form.patchValue({
      name: southItem.name,
      scanMode: this.scanModes.find(scanMode => scanMode.id === southItem.scanModeId) || null
    });
    this.createSettingsInputs();
  }

  /**
   * Prepares the component for edition.
   */
  prepareForCopy(
    southConnector: SouthConnectorDTO,
    southItemSchema: OibusItemManifest,
    scanModes: Array<ScanModeDTO>,
    southItem: OibusItemDTO
  ) {
    this.item = southItem;
    this.item.name = `${southItem.name}-copy`;
    this.mode = 'create';
    this.southConnector = southConnector;
    this.southItemSchema = southItemSchema;
    this.scanModes = scanModes;
    this.southItemSchema.settings.forEach(element => {
      if (this.item?.settings) {
        element.currentValue = this.item.settings[element.key];
      }
    });

    this.form.patchValue({
      name: this.item.name,
      scanMode: this.scanModes.find(scanMode => scanMode.id === this.item?.scanModeId) || null
    });
    this.createSettingsInputs();
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    const command: OibusItemCommandDTO = {
      name: formValue.name!,
      scanModeId: formValue.scanMode?.id || 'subscription',
      settings: formValue.settings!
    };

    let obs: Observable<OibusItemDTO>;
    if (this.mode === 'create') {
      obs = this.southConnectorService.createSouthItem(this.southConnector!.id, command);
    } else {
      obs = this.southConnectorService
        .updateSouthItem(this.southConnector!.id, this.item!.id, command)
        .pipe(switchMap(() => this.southConnectorService.getSouthConnectorItem(this.southConnector!.id, this.item!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(southItem => {
      this.modal.close(southItem);
    });
  }
}
