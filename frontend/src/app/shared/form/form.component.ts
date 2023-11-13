import { Component, Input, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { ControlContainer, FormGroup, FormGroupName } from '@angular/forms';
import { formDirectives } from '../form-directives';
import { OibFormControl, OibFormGroup, OibSelectFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { OibCodeBlockComponent } from './oib-code-block/oib-code-block.component';
import { Timezone } from '../../../../../shared/model/types';
import { Observable } from 'rxjs';
import { inMemoryTypeahead } from '../typeahead';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { OibArrayComponent } from './oib-form-array/oib-array.component';
import { groupFormControlsByRow } from '../form-utils';
import { PipeProviderService } from './pipe-provider.service';
import { CertificateDTO } from '../../../../../shared/model/certificate.model';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}

@Component({
  selector: 'oib-form',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf, OibCodeBlockComponent, NgbTypeahead, TranslateModule, OibArrayComponent],
  templateUrl: './form.component.html',
  styleUrl: './form.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ]
})
export class FormComponent implements OnInit {
  @Input() settingsSchema: Array<Array<OibFormControl>> = [];
  @Input() scanModes: Array<ScanModeDTO> = [];
  @Input() certificates: Array<CertificateDTO> = [];
  @Input({ required: true }) form!: FormGroup;

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );
  protected readonly FormGroup = FormGroup;

  settingsGroupedByRowByFormGroup = new Map<string, Array<Array<OibFormControl>>>();

  constructor(private pipeProviderService: PipeProviderService) {}

  ngOnInit(): void {
    this.settingsSchema.forEach(settings => {
      settings.forEach(setting => {
        if (setting.type === 'OibFormGroup') {
          this.settingsGroupedByRowByFormGroup.set(setting.key, groupFormControlsByRow(setting.content));
        }
      });
    });
    this.form.setValue(this.form.getRawValue());
  }

  getFormGroup(setting: OibFormGroup): FormGroup {
    return this.form.controls[setting.key] as FormGroup;
  }

  transform(value: string, pipeIdentifier: string | undefined): string {
    if (!pipeIdentifier || !this.pipeProviderService.validIdentifier(pipeIdentifier)) {
      return value;
    }
    return this.pipeProviderService.getPipeForString(pipeIdentifier).transform(value);
  }

  checkIfRequired(setting: OibSelectFormControl) {
    return setting.validators?.some(validator => validator.key === 'required');
  }
}
