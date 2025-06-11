import { Component, OnInit, input, forwardRef } from '@angular/core';

import { AbstractControl, FormControl, FormGroup, FormSubmittedEvent } from '@angular/forms';
import { formDirectives } from '../form-directives';
import { OibFormControl, OibSelectFormControl } from '../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { OibCodeBlockComponent } from './oib-code-block/oib-code-block.component';
import { Timezone } from '../../../../../backend/shared/model/types';
import { filter, Observable } from 'rxjs';
import { inMemoryTypeahead } from '../typeahead';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { OibArrayComponent } from './oib-form-array/oib-array.component';
import { groupFormControlsByRow } from '../form-utils';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';

@Component({
  selector: 'oib-form',
  imports: [...formDirectives, OibCodeBlockComponent, NgbTypeahead, TranslateDirective, forwardRef(() => OibArrayComponent), TranslatePipe],
  templateUrl: './form.component.html',
  styleUrl: './form.component.scss'
})
export class FormComponent implements OnInit {
  readonly settingsSchema = input<Array<Array<OibFormControl>>>([]);
  readonly scanModes = input<Array<ScanModeDTO>>([]);
  readonly certificates = input<Array<CertificateDTO>>([]);
  readonly form = input.required<FormGroup>();
  readonly parentForm = input.required<FormGroup>();

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );
  protected readonly FormGroup = FormGroup;

  settingsGroupedByRowByFormGroup = new Map<string, Array<Array<OibFormControl>>>();

  ngOnInit(): void {
    this.settingsSchema().forEach(settings => {
      settings.forEach(setting => {
        if (setting.type === 'OibFormGroup') {
          this.settingsGroupedByRowByFormGroup.set(setting.key, groupFormControlsByRow(setting.content));
        }
      });
    });
    this.form().setValue(this.form().getRawValue());
    this.parentForm()
      .events.pipe(filter(event => event instanceof FormSubmittedEvent))
      .subscribe(() => this.form().markAllAsTouched());
  }

  asFormGroup(abstractControl: AbstractControl): FormGroup {
    return abstractControl as FormGroup;
  }

  asFormControl(abstractControl: AbstractControl): FormControl {
    return abstractControl as FormControl;
  }

  checkIfRequired(setting: OibSelectFormControl) {
    return setting.validators?.some(validator => validator.key === 'required');
  }
}
