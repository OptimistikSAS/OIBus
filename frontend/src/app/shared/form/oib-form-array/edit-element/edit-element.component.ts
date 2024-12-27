import { Component, forwardRef, Input, OnInit, inject, output } from '@angular/core';
import { FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { formDirectives } from '../../../form-directives';
import { OibFormControl } from '../../../../../../../backend/shared/model/form.model';
import { createFormGroup, groupFormControlsByRow } from '../../../form-utils';
import { FormComponent } from '../../form.component';

@Component({
  selector: 'oib-edit-element',
  templateUrl: './edit-element.component.html',
  styleUrl: './edit-element.component.scss',
  imports: [...formDirectives, forwardRef(() => FormComponent)]
})
export class EditElementComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);

  form: FormGroup | null = null;
  controlsByRow: Array<Array<OibFormControl>> | null = null;

  @Input({ required: true }) formDescription!: Array<OibFormControl>;
  @Input({ required: true }) element!: any;
  @Input({ required: true }) existingElements!: Array<any>;
  @Input({ required: true }) parentForm!: FormGroup;

  readonly saved = output<any>();
  readonly cancelled = output<void>();

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
