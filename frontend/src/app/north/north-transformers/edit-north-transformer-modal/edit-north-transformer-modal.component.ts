import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { formDirectives } from '../../../shared/form-directives';
import { createFormGroup, groupFormControlsByRow } from '../../../shared/form-utils';
import { TransformerLightDTO } from '../../../../../../backend/shared/model/transformer.model';
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
  inputType = '';
  transformers: Array<TransformerLightDTO> = [];
  supportedOutputTypes: Array<string> = [];
  transformerRows: Array<Array<OibFormControl>> = [];

  prepare(
    inputType: string,
    transformers: Array<TransformerLightDTO>,
    supportedOutputTypes: Array<string>,
    transformer: TransformerLightDTO | null,
    options: object
  ) {
    this.inputType = inputType;
    this.transformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    if (transformer) {
      this.transformerService.get(transformer.id).subscribe(fullTransformer => {
        this.transformerRows = groupFormControlsByRow(fullTransformer.manifest);
        this.form = this.fb.group({
          transformerId: this.fb.control<string | null>(transformer.id as string | null),
          options: createFormGroup(fullTransformer.manifest, this.fb)
        });
        this.form!.patchValue({
          options: options
        });
        this.subscribeOnTransformerChange();
      });
    } else {
      this.form = this.fb.group({
        transformerId: this.fb.control<string | null>(null as string | null),
        options: this.fb.group({})
      });
      this.subscribeOnTransformerChange();
    }
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

    if (!this.form!.value.transformerId) {
      this.modal.close({ transformer: null, options: {} });
    } else {
      this.modal.close({
        transformer: this.transformers.find(transformer => transformer.id === this.form!.value.transformerId)!,
        options: this.form!.value.options
      });
    }
  }
}
