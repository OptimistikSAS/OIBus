import { Component } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemManifest
} from '../../../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { NgForOf, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { HistoryQueryService } from '../../services/history-query.service';
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
    NgbTypeahead,
    FormComponent
  ],
  standalone: true
})
export class EditHistoryQueryItemModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  historyQuery: HistoryQueryDTO | null = null;

  southItemSchema: SouthConnectorItemManifest | null = null;
  southItemRows: Array<Array<OibFormControl>> = [];
  subscriptionOnly = false;

  item: SouthConnectorItemDTO | null = null;

  form: FormGroup<{
    name: FormControl<string>;
    settings: FormGroup;
  }> | null = null;

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  constructor(private modal: NgbActiveModal, private fb: NonNullableFormBuilder, private historyQueryService: HistoryQueryService) {}

  private createForm(item: SouthConnectorItemDTO | null) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      settings: createFormGroup(this.southItemSchema!.settings, this.fb)
    });

    // if we have an item we initialize the values
    if (item) {
      this.form.patchValue(item);
    }
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(historyQuery: HistoryQueryDTO, southItemSchema: SouthConnectorItemManifest) {
    this.mode = 'create';
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.createForm(null);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForCopy(historyQuery: HistoryQueryDTO, southItemSchema: SouthConnectorItemManifest, item: SouthConnectorItemDTO) {
    this.item = JSON.parse(JSON.stringify(item)) as SouthConnectorItemDTO;
    this.item.name = `${item.name}-copy`;
    this.mode = 'create';
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.createForm(this.item);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(historyQuery: HistoryQueryDTO, southItemSchema: SouthConnectorItemManifest, item: SouthConnectorItemDTO) {
    this.mode = 'edit';
    this.item = item;
    this.historyQuery = historyQuery;
    this.southItemSchema = southItemSchema;
    this.southItemRows = groupFormControlsByRow(southItemSchema.settings);
    this.createForm(item);
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
      name: formValue.name!,
      scanModeId: 'history',
      settings: formValue.settings!
    };

    let obs: Observable<SouthConnectorItemDTO>;
    if (this.mode === 'create') {
      obs = this.historyQueryService.createItem(this.historyQuery!.id, command);
    } else {
      obs = this.historyQueryService
        .updateItem(this.historyQuery!.id, this.item!.id, command)
        .pipe(switchMap(() => this.historyQueryService.getItem(this.historyQuery!.id, this.item!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(southItem => {
      this.modal.close(southItem);
    });
  }
}
