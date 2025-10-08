import { Component, inject, ViewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import {
  CUSTOM_TRANSFORMER_LANGUAGES,
  CustomTransformerCommandDTO,
  CustomTransformerDTO,
  INPUT_TYPES,
  InputType,
  OUTPUT_TYPES,
  OutputType,
  TransformerDTO,
  TransformerLanguage
} from '../../../../../../backend/shared/model/transformer.model';
import { Observable, switchMap } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../../services/transformer.service';
import { ModalService } from '../../../shared/modal.service';
import { TestTransformerModalComponent } from '../test-transformer-modal/test-transformer-modal.component';
import { OibusInputDataTypeEnumPipe } from '../../../shared/oibus-input-data-type-enum.pipe';
import { OibusOutputDataTypeEnumPipe } from '../../../shared/oibus-output-data-type-enum.pipe';
import { OIBusTransformerLanguageEnumPipe } from '../../../shared/oibus-transformer-language-enum.pipe';
import { OIBusAttribute } from '../../../../../../backend/shared/model/form.model';
import { ManifestAttributesArrayComponent } from '../../../shared/form/manifest-builder/manifest-attributes-array/manifest-attributes-array.component';

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
    OibusOutputDataTypeEnumPipe,
    OIBusTransformerLanguageEnumPipe,
    ManifestAttributesArrayComponent,
    TranslatePipe
  ]
})
export class EditTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private transformerService = inject(TransformerService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private modalService = inject(ModalService);
  private fb = inject(NonNullableFormBuilder);

  @ViewChild(OibCodeBlockComponent) editor: OibCodeBlockComponent | null = null;
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();

  customTransformer: CustomTransformerDTO | null = null;

  inputTypes = INPUT_TYPES;
  outputTypes = OUTPUT_TYPES;
  languages = CUSTOM_TRANSFORMER_LANGUAGES;

  inputType = this.fb.control(null as InputType | null, Validators.required);
  outputType = this.fb.control(null as OutputType | null, Validators.required);
  language = this.fb.control(null as TransformerLanguage | null, Validators.required);
  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    customCode: ['', Validators.required],
    attributes: this.fb.control([] as Array<OIBusAttribute>)
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
      attributes: transformer.manifest.attributes
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

  test() {
    if (!this.customTransformer || !this.form) {
      return;
    }

    const modalRef = this.modalService.open(TestTransformerModalComponent, {
      size: 'xl',
      windowClass: 'test-transformer-modal'
    });

    const component: TestTransformerModalComponent = modalRef.componentInstance;
    const formValue = this.form.value;

    component.prepareForCreation(this.customTransformer, formValue.customCode, formValue.attributes);
  }

  save() {
    if (!this.form!.valid) {
      return;
    }

    let inputType: InputType;
    let outputType: OutputType;
    let language: TransformerLanguage;
    if (this.mode === 'create') {
      if (!this.inputType.valid || !this.outputType.valid || !this.language.valid) {
        return;
      }
      inputType = this.inputType.value!;
      outputType = this.outputType.value!;
      language = this.language.value!;
    } else {
      inputType = this.customTransformer!.inputType;
      outputType = this.customTransformer!.outputType;
      language = this.customTransformer!.language;
    }
    const formValue = this.form!.value;

    const command: CustomTransformerCommandDTO = {
      type: 'custom',
      inputType,
      outputType,
      language,
      name: formValue.name!,
      description: formValue.description!,
      customCode: formValue.customCode!,
      customManifest: {
        type: 'object',
        key: 'options',
        translationKey: 'configuration.oibus.manifest.transformers.choose-transformer-modal.options',
        attributes: formValue.attributes!,
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      }
    };

    let obs: Observable<TransformerDTO>;
    if (this.mode === 'create') {
      obs = this.transformerService.create(command);
    } else {
      obs = this.transformerService
        .update(this.customTransformer!.id, command)
        .pipe(switchMap(() => this.transformerService.findById(this.customTransformer!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(transformer => {
      this.modal.close(transformer);
    });
  }
}
