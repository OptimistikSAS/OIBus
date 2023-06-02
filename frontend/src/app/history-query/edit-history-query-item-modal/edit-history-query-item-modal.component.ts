import { Component } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { OibusItemCommandDTO, OibusItemDTO, OibusItemManifest } from '../../../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { NgForOf, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { createInput, disableInputs, getRowSettings } from '../../shared/utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { HistoryQueryService } from '../../services/history-query.service';
import { Timezone } from '../../../../../shared/model/types';
import { inMemoryTypeahead } from '../../shared/typeahead';
import { OibFormControl } from '../../../../../shared/model/form.model';

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
    OibScanModeComponent,
    NgbTypeahead
  ],
  standalone: true
})
export class EditHistoryQueryItemModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  historyQuery: HistoryQueryDTO | null = null;
  southItemSchema: OibusItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];
  item: OibusItemDTO | null = null;
  form = this.fb.group({
    name: ['', Validators.required],
    settings: this.fb.record({})
  });

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private historyQueryService: HistoryQueryService) {}

  private createSettingsInputs() {
    const inputsToSubscribeTo: Set<string> = new Set();
    const settingsForm = this.form.controls.settings;
    this.southItemRows.forEach(row => {
      row.forEach(setting => {
        createInput(setting, settingsForm);
        if (setting.conditionalDisplay) {
          Object.entries(setting.conditionalDisplay).forEach(([key]) => {
            // Keep only one occurrence of each input to subscribe to
            inputsToSubscribeTo.add(key);
          });
        }
      });
    });
    // Each input that must be monitored is subscribed
    inputsToSubscribeTo.forEach(input => {
      // Check once with initialized value
      disableInputs(this.southItemSchema!.settings, input, settingsForm.controls[input].value, settingsForm);
      // Check on value changes
      settingsForm.controls[input].valueChanges.subscribe(inputValue => {
        // When a value of such an input changes, check if its inputValue implies to disable another input
        disableInputs(this.southItemSchema!.settings, input, inputValue, settingsForm);
      });
    });
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(historyQuery: HistoryQueryDTO, southItemSchema: OibusItemManifest) {
    this.mode = 'create';
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;
    this.southItemRows = getRowSettings(southItemSchema.settings, null);
    this.createSettingsInputs();
  }

  /**
   * Prepares the component for edition.
   */
  prepareForCopy(historyQuery: HistoryQueryDTO, southItemSchema: OibusItemManifest, item: OibusItemDTO) {
    this.item = JSON.parse(JSON.stringify(item)) as OibusItemDTO;
    this.item.name = `${item.name}-copy`;
    this.mode = 'create';
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;
    this.southItemRows = getRowSettings(southItemSchema.settings, null);
    this.southItemSchema.settings.forEach(element => {
      if (this.item?.settings) {
        element.currentValue = this.item.settings[element.key];
      }
    });

    this.form.patchValue({
      name: this.item.name
    });
    this.createSettingsInputs();
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(historyQuery: HistoryQueryDTO, southItemSchema: OibusItemManifest, item: OibusItemDTO) {
    this.mode = 'edit';
    this.item = item;
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;

    this.southItemSchema.settings.forEach(element => {
      if (this.item?.settings) {
        element.currentValue = this.item.settings[element.key];
      }
    });

    this.form.patchValue({
      name: this.item.name
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
        .updateSouthItem(this.historyQuery!.id, this.item!.id, command)
        .pipe(switchMap(() => this.historyQueryService.getSouthConnectorItem(this.historyQuery!.id, this.item!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(southItem => {
      this.modal.close(southItem);
    });
  }
}
