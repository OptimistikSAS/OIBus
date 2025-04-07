import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { formDirectives } from '../../../shared/form-directives';
import { createFormGroup, groupFormControlsByRow } from '../../../shared/form-utils';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../../services/transformer.service';
import { OibTransformerComponent } from '../../../shared/form/oib-transformer/oib-transformer.component';
import { OibFormControl } from '../../../../../../backend/shared/model/form.model';
import { FormComponent } from '../../../shared/form/form.component';

@Component({
  selector: 'oib-edit-north-transformer-modal',
  templateUrl: './edit-north-transformer-modal.component.html',
  styleUrl: './edit-north-transformer-modal.component.scss',
  imports: [...formDirectives, TranslateDirective, SaveButtonComponent, TranslatePipe, OibTransformerComponent, FormComponent]
})
export class EditNorthTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private transformerService = inject(TransformerService);

  state = new ObservableState();
  form: FormGroup<{
    transformerId: FormControl<string | null>;
    options: FormGroup;
  }> | null = null;
  inputTypeControl: FormControl<string | null> | null = null;
  allTransformers: Array<TransformerDTO> = [];
  selectableTransformers: Array<TransformerDTO> = [];
  selectableInputs: Array<string> = [];
  supportedOutputTypes: Array<string> = [];
  transformerRows: Array<Array<OibFormControl>> = [];

  prepareForCreation(selectableInputs: Array<string>, transformers: Array<TransformerDTO>, supportedOutputTypes: Array<string>) {
    this.selectableInputs = selectableInputs;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.form = this.fb.group({
      transformerId: this.fb.control<string | null>(null as string | null),
      options: this.fb.group({})
    });
    this.inputTypeControl = this.fb.control<string | null>(null as string | null, Validators.required);
    this.inputTypeControl.valueChanges.subscribe(inputType => {
      this.selectableTransformers = this.allTransformers.filter(
        element =>
          (element.type === 'standard' && element.functionName === 'ignore') ||
          (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes.includes(element.inputType)) ||
          element.inputType === inputType
      );
    });

    this.subscribeOnTransformerChange();
  }

  prepareForEdition(
    transformerWithOptions: TransformerDTOWithOptions,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.selectableTransformers = transformers.filter(
      element =>
        element.inputType === transformerWithOptions.inputType ||
        (transformerWithOptions.transformer.type === 'standard' &&
          ['ignore', 'iso'].includes(transformerWithOptions.transformer.functionName))
    );
    this.supportedOutputTypes = supportedOutputTypes;
    this.transformerService.get(transformerWithOptions.transformer.id).subscribe(fullTransformer => {
      this.transformerRows = groupFormControlsByRow(fullTransformer.manifest);
      this.form = this.fb.group({
        transformerId: this.fb.control<string | null>(transformerWithOptions.transformer.id as string | null),
        options: createFormGroup(fullTransformer.manifest, this.fb)
      });
      this.form!.patchValue({
        options: transformerWithOptions.options
      });
      this.subscribeOnTransformerChange();
    });
  }

  cancel() {
    this.modal.dismiss();
  }

  private subscribeOnTransformerChange() {
    this.form!.controls.transformerId.valueChanges.pipe(
      switchMap(transformerId => (transformerId ? this.transformerService.get(transformerId) : of(null)))
    ).subscribe(newTransformer => {
      if (newTransformer) {
        this.transformerRows = groupFormControlsByRow(newTransformer.manifest);
        this.form!.setControl('options', createFormGroup(newTransformer.manifest, this.fb));
      } else {
        this.transformerRows = [];
        this.form!.setControl('options', this.fb.group({}));
      }
    });
  }

  save() {
    if (!this.form!.valid) {
      return;
    }

    const transformer = this.selectableTransformers.find(transformer => transformer.id === this.form!.value.transformerId)!;
    const inputType = this.inputTypeControl ? this.inputTypeControl.getRawValue()! : transformer.inputType;

    if (!transformer || !inputType) {
      return;
    }

    this.modal.close({
      transformer: this.selectableTransformers.find(transformer => transformer.id === this.form!.value.transformerId)!,
      options: this.form!.value.options,
      inputType
    });
  }
}
