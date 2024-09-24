import { Component, EventEmitter, forwardRef, Input, OnInit, Output, inject } from '@angular/core';
import { FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { formDirectives } from '../../../form-directives';

import { TranslateModule } from '@ngx-translate/core';
import { OibFormControl } from '../../../../../../../shared/model/form.model';
import { createFormGroup, groupFormControlsByRow } from '../../../form-utils';
import { FormComponent } from '../../form.component';

@Component({
  selector: 'oib-edit-element',
  templateUrl: './edit-element.component.html',
  styleUrl: './edit-element.component.scss',
  imports: [...formDirectives, TranslateModule, forwardRef(() => FormComponent)],
  standalone: true
})
export class EditElementComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);

  form: FormGroup | null = null;
  controlsByRow: Array<Array<OibFormControl>> | null = null;

  @Input({ required: true }) formDescription!: Array<OibFormControl>;
  @Input({ required: true }) element!: any;
  @Input({ required: true }) existingElements!: Array<any>;

  @Output() readonly saved = new EventEmitter<any>();
  @Output() readonly cancelled = new EventEmitter<void>();

  ngOnInit() {
    this.controlsByRow = groupFormControlsByRow(this.formDescription);
    // we need to wrap in a sub form group to be able to inject properly into the oib-form
    this.form = this.fb.group({ wrapper: createFormGroup(this.formDescription, this.fb) });
    this.form.patchValue({ wrapper: this.element });
  }

  getFormGroup(): FormGroup {
    return this.form!.controls['wrapper']! as FormGroup;
  }

  ok() {
    if (!this.form!.valid) {
      return;
    }

    this.saved.emit(this.form!.controls['wrapper'].value);
  }

  cancel() {
    this.cancelled.emit(undefined);
  }
}
