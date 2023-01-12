import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorDTO, SouthItemCommandDTO, SouthItemDTO, SouthItemManifest } from '../../model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ScanModeDTO } from '../../model/scan-mode.model';
import { NgForOf, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { OibScanModeFormControl } from '../../model/form.model';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { OibTextComponent } from '../../shared/form/oib-text/oib-text.component';
import { OibTextAreaComponent } from '../../shared/form/oib-text-area/oib-text-area.component';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { OibNumberComponent } from '../../shared/form/oib-number/oib-number.component';
import { OibSelectComponent } from '../../shared/form/oib-select/oib-select.component';
import { OibCheckboxComponent } from '../../shared/form/oib-checkbox/oib-checkbox.component';
import { OibSecretComponent } from '../../shared/form/oib-secret/oib-secret.component';
import { OibTimezoneComponent } from '../../shared/form/oib-timezone/oib-timezone.component';
import { createInput } from '../../shared/utils';

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
    OibScanModeComponent,
    OibTextComponent,
    OibTextAreaComponent,
    OibCodeBlockComponent,
    OibNumberComponent,
    OibSelectComponent,
    OibCheckboxComponent,
    OibSecretComponent,
    OibTimezoneComponent
  ],
  standalone: true
})
export class EditSouthItemModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  southConnector: SouthConnectorDTO | null = null;
  southItemSchema: SouthItemManifest | null = null;
  southItem: SouthItemDTO | null = null;
  scanModes: Array<ScanModeDTO> = [];
  scanModeOptions: OibScanModeFormControl | null = null;
  form = this.fb.group({
    name: ['', Validators.required],
    scanMode: [null as ScanModeDTO | null, Validators.required],
    settings: this.fb.record({})
  });

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
  prepareForCreation(southConnector: SouthConnectorDTO, southItemSchema: SouthItemManifest, scanModes: Array<ScanModeDTO>) {
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
    southItemSchema: SouthItemManifest,
    scanModes: Array<ScanModeDTO>,
    southItem: SouthItemDTO
  ) {
    this.mode = 'edit';
    this.southItem = southItem;
    this.southConnector = southConnector;
    this.southItemSchema = southItemSchema;
    this.scanModes = scanModes;

    this.southItemSchema.settings.forEach(element => {
      if (this.southItem?.settings) {
        element.currentValue = this.southItem.settings[element.key];
      }
    });

    this.form.patchValue({
      name: southItem.name,
      scanMode: this.scanModes.find(scanMode => scanMode.id === southItem.scanModeId) || null
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

    const command: SouthItemCommandDTO = {
      name: formValue.name!,
      scanModeId: formValue.scanMode?.id || null,
      settings: formValue.settings!
    };
    if (command.scanModeId === 'subscribe') {
      command.scanModeId = null;
    }

    let obs: Observable<SouthItemDTO>;
    if (this.mode === 'create') {
      obs = this.southConnectorService.createSouthItem(this.southConnector!.id, command);
    } else {
      obs = this.southConnectorService
        .updateSouthItem(this.southConnector!.id, this.southItem!.id, command)
        .pipe(switchMap(() => this.southConnectorService.getSouthConnectorItem(this.southConnector!.id, this.southItem!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(southItem => {
      this.modal.close(southItem);
    });
  }
}
