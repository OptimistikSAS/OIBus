import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { TransformerService } from '../../../services/transformer.service';
import { CustomTransformerCommandDTO } from '../../../../../../backend/shared/model/transformer.model';
import { OibusInputDataTypeEnumPipe } from '../../../shared/oibus-input-data-type-enum.pipe';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';

@Component({
  selector: 'oib-test-transformer-modal',
  templateUrl: './test-transformer-modal.component.html',
  styleUrl: './test-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    OI_FORM_VALIDATION_DIRECTIVES,
    OibCodeBlockComponent,
    OibusInputDataTypeEnumPipe,
    OIBusObjectFormControlComponent
  ]
})
export class TestTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private transformerService = inject(TransformerService);
  private fb = inject(NonNullableFormBuilder);

  readonly transformer = signal<CustomTransformerCommandDTO | null>(null);
  readonly inputTemplate = signal<string>('');
  readonly output = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string>('');

  state = new ObservableState();

  form = this.fb.group({
    inputData: ['', Validators.required],
    options: this.fb.group({})
  });

  outputControl = this.fb.control('');

  prepare(transformer: CustomTransformerCommandDTO) {
    this.transformer.set(transformer);
    this.loadInputTemplate();
    this.createOptionsForm(transformer.customManifest);
  }

  private loadInputTemplate() {
    const transformer = this.transformer()!;

    this.isLoading.set(true);
    this.transformerService.getInputTemplate(transformer.inputType).subscribe({
      next: template => {
        this.inputTemplate.set(template.data);
        this.form.patchValue({ inputData: template.data });
        this.isLoading.set(false);
      },
      error: error => {
        this.error.set('Failed to load input template: ' + error.message);
        this.isLoading.set(false);
      }
    });
  }

  createOptionsForm(manifest: OIBusObjectAttribute) {
    this.form.setControl('options', this.fb.group({}));
    for (const attribute of manifest.attributes) {
      addAttributeToForm(this.fb, this.form.controls.options, attribute);
    }
    addEnablingConditions(this.form.controls.options, manifest.enablingConditions);
  }

  test() {
    const transformer = this.transformer();
    if (!this.form.valid || !transformer) {
      return;
    }

    const formValue = this.form.value;

    this.isLoading.set(true);
    this.error.set('');

    const testRequest = {
      inputData: formValue.inputData!,
      options: formValue.options || []
    };

    this.transformerService.test(transformer, testRequest).subscribe({
      next: response => {
        this.error.set('');
        try {
          const parsedOutput = JSON.parse(response.output);
          const prettifiedOutput = JSON.stringify(parsedOutput, null, 2);
          this.output.set(prettifiedOutput);
          this.outputControl.setValue(prettifiedOutput);
        } catch (_error) {
          this.output.set(response.output);
          this.outputControl.setValue(response.output);
        }
        this.isLoading.set(false);
      },
      error: error => {
        this.output.set('');
        this.error.set(error.message);
        this.isLoading.set(false);
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
