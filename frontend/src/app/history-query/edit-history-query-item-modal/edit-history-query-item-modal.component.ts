import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { OibusItemCommandDTO, OibusItemDTO, OibusItemManifest } from '../../../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { NgForOf, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { createInput } from '../../shared/utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { HistoryQueryService } from '../../services/history-query.service';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}
@Component({
  selector: 'oib-edit-history-query-item-modal',
  templateUrl: './edit-history-query-item-modal.component.html',
  styleUrls: ['./edit-history-query-item-modal.component.scss'],
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    NgSwitch,
    NgSwitchCase,
    NgIf,
    OibCodeBlockComponent,
    OibScanModeComponent
  ],
  standalone: true
})
export class EditHistoryQueryItemModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  historyQuery: HistoryQueryDTO | null = null;
  southItemSchema: OibusItemManifest | null = null;
  southItem: OibusItemDTO | null = null;
  timezones = Intl.supportedValuesOf('timeZone');
  form = this.fb.group({
    name: ['', Validators.required],
    settings: this.fb.record({})
  });

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private historyQueryService: HistoryQueryService) {}

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
  prepareForCreation(historyQuery: HistoryQueryDTO, southItemSchema: OibusItemManifest) {
    this.mode = 'create';
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;
    this.createSettingsInputs();
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(historyQuery: HistoryQueryDTO, southItemSchema: OibusItemManifest, southItem: OibusItemDTO) {
    this.mode = 'edit';
    this.southItem = southItem;
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;

    this.southItemSchema.settings.forEach(element => {
      if (this.southItem?.settings) {
        element.currentValue = this.southItem.settings[element.key];
      }
    });

    this.form.patchValue({
      name: southItem.name
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
      scanModeId: null,
      settings: formValue.settings!
    };

    let obs: Observable<OibusItemDTO>;
    if (this.mode === 'create') {
      obs = this.historyQueryService.createSouthItem(this.historyQuery!.id, command);
    } else {
      obs = this.historyQueryService
        .updateSouthItem(this.historyQuery!.id, this.southItem!.id, command)
        .pipe(switchMap(() => this.historyQueryService.getSouthConnectorItem(this.historyQuery!.id, this.southItem!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(southItem => {
      this.modal.close(southItem);
    });
  }
}
