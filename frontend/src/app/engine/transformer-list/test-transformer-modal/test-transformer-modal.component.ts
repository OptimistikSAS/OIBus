import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { ManifestAttributesArrayComponent } from '../../../shared/form/manifest-builder/manifest-attributes-array/manifest-attributes-array.component';
import { TransformerService } from '../../../services/transformer.service';
import { CustomTransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { OibusInputDataTypeEnumPipe } from '../../../shared/oibus-input-data-type-enum.pipe';

@Component({
  selector: 'oib-test-transformer-modal',
  templateUrl: './test-transformer-modal.component.html',
  styleUrl: './test-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    OibCodeBlockComponent,
    ManifestAttributesArrayComponent,
    OibusInputDataTypeEnumPipe
  ]
})
export class TestTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private transformerService = inject(TransformerService);
  private fb = inject(NonNullableFormBuilder);

  readonly transformer = signal<CustomTransformerDTO | null>(null);
  readonly inputTemplate = signal<string>('');
  readonly output = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string>('');

  state = new ObservableState();

  form = this.fb.group({
    inputData: ['', Validators.required],
    options: this.fb.control([])
  });

  outputControl = this.fb.control('');

  prepareForCreation(transformer: CustomTransformerDTO, _customCode?: string, customManifest?: any) {
    this.transformer.set(transformer);
    this.loadInputTemplate();

    // Pre-fill options if provided from edit modal
    if (customManifest) {
      this.form.patchValue({ options: Array.isArray(customManifest) ? customManifest : [customManifest] } as any);
    }
  }

  private loadInputTemplate() {
    const transformer = this.transformer();
    if (!transformer) return;

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

  test() {
    if (!this.form.valid || !this.transformer()) {
      return;
    }

    const transformer = this.transformer()!;
    const formValue = this.form.value;

    this.isLoading.set(true);
    this.error.set('');

    const testRequest = {
      inputData: formValue.inputData!,
      options: formValue.options || []
    };

    this.transformerService.test(transformer.id, testRequest).subscribe({
      next: response => {
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
        this.error.set('Test failed: ' + error.message);
        this.isLoading.set(false);
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
