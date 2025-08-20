import { Component, inject, ViewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';

import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import {
  CustomTransformerCommand,
  CustomTransformerDTO,
  INPUT_TYPES,
  InputType,
  OUTPUT_TYPES,
  OutputType,
  TransformerDTO
} from '../../../../../../backend/shared/model/transformer.model';
import { Observable, switchMap } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../../services/transformer.service';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { OibusInputDataTypeEnumPipe } from '../../../shared/oibus-input-data-type-enum.pipe';
import { OibusOutputDataTypeEnumPipe } from '../../../shared/oibus-output-data-type-enum.pipe';

@Component({
  selector: 'oib-edit-transformer-modal',
  templateUrl: './edit-transformer-modal.component.html',
  styleUrl: './edit-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    OI_FORM_VALIDATION_DIRECTIVES,
    OibCodeBlockComponent,
    SaveButtonComponent,
    OibusInputDataTypeEnumPipe,
    OibusOutputDataTypeEnumPipe
  ]
})
export class EditTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private transformerService = inject(TransformerService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  @ViewChild(OibCodeBlockComponent) editor: OibCodeBlockComponent | null = null;
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();

  customTransformer: CustomTransformerDTO | null = null;

  inputTypes = INPUT_TYPES;
  outputTypes = OUTPUT_TYPES;

  inputType = this.fb.control(null as InputType | null, Validators.required);
  outputType = this.fb.control(null as OutputType | null, Validators.required);
  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    customCode: ['', Validators.required],
    customManifest: ['', Validators.required]
  });

  prepareForCreation() {
    this.mode = 'create';
  }

  prepareForEdition(transformer: CustomTransformerDTO) {
    this.mode = 'edit';
    this.customTransformer = transformer;
    this.form.patchValue({
      name: transformer.name,
      description: transformer.description,
      customCode: transformer.customCode,
      customManifest: JSON.stringify(transformer.manifest)
    });
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form!.valid) {
      return;
    }

    let inputType: InputType;
    let outputType: OutputType;
    if (this.mode === 'create') {
      if (!this.inputType.valid || !this.outputType.valid) {
        return;
      }
      inputType = this.inputType.value!;
      outputType = this.outputType.value!;
    } else {
      inputType = this.customTransformer!.inputType;
      outputType = this.customTransformer!.outputType;
    }
    const formValue = this.form!.value;

    const command: CustomTransformerCommand = {
      type: 'custom',
      inputType,
      outputType,
      name: formValue.name!,
      description: formValue.description!,
      customCode: formValue.customCode!,
      customManifest: JSON.parse(formValue.customManifest!) as OIBusObjectAttribute
    };

    let obs: Observable<TransformerDTO>;
    if (this.mode === 'create') {
      obs = this.transformerService.create(command);
    } else {
      obs = this.transformerService
        .update(this.customTransformer!.id, command)
        .pipe(switchMap(() => this.transformerService.get(this.customTransformer!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(transformer => {
      this.modal.close(transformer);
    });
  }
}
