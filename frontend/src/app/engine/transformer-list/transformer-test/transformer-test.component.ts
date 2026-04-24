import { Component, inject, input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { TransformerService } from '../../../services/transformer.service';
import { CustomTransformerCommandDTO } from '../../../../../../backend/shared/model/transformer.model';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';

@Component({
  selector: 'oib-transformer-test',
  templateUrl: './transformer-test.component.html',
  styleUrl: './transformer-test.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, OibCodeBlockComponent, OIBusObjectFormControlComponent]
})
export class TransformerTestComponent implements OnChanges {
  private transformerService = inject(TransformerService);
  private fb = inject(NonNullableFormBuilder);

  readonly transformer = input<CustomTransformerCommandDTO | null>(null);

  readonly output = signal<string>('');
  readonly error = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  form = this.fb.group({
    inputData: ['', Validators.required],
    options: this.fb.group({})
  });
  outputControl = this.fb.control('');

  private prevInputType: string | null = null;
  private prevManifestJson: string | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['transformer']) return;
    const transformer = this.transformer();
    if (!transformer) {
      this.prevInputType = null;
      this.prevManifestJson = null;
      return;
    }

    if (transformer.inputType !== this.prevInputType) {
      this.prevInputType = transformer.inputType;
      this.loadInputTemplate(transformer.inputType);
    }

    const manifestJson = JSON.stringify(transformer.customManifest.attributes);
    if (manifestJson !== this.prevManifestJson) {
      this.prevManifestJson = manifestJson;
      this.createOptionsForm(transformer.customManifest);
    }
  }

  private loadInputTemplate(inputType: string) {
    this.isLoading.set(true);
    this.error.set('');
    this.transformerService.getInputTemplate(inputType).subscribe({
      next: template => {
        this.form.patchValue({ inputData: template.data });
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set('Failed to load input template: ' + err.message);
        this.isLoading.set(false);
      }
    });
  }

  private createOptionsForm(manifest: OIBusObjectAttribute) {
    this.form.setControl('options', this.fb.group({}));
    for (const attribute of manifest.attributes) {
      addAttributeToForm(this.fb, this.form.controls.options, attribute);
    }
    addEnablingConditions(this.form.controls.options, manifest.enablingConditions);
  }

  test() {
    const transformer = this.transformer();
    if (!this.form.valid || !transformer) return;

    const formValue = this.form.value;
    this.isLoading.set(true);
    this.error.set('');
    this.output.set('');

    this.transformerService
      .test(transformer, {
        inputData: formValue.inputData!,
        options: formValue.options || {}
      })
      .subscribe({
        next: response => {
          this.error.set('');
          try {
            const parsed = JSON.parse(response.output);
            const pretty = JSON.stringify(parsed, null, 2);
            this.output.set(pretty);
            this.outputControl.setValue(pretty);
          } catch {
            this.output.set(response.output);
            this.outputControl.setValue(response.output);
          }
          this.isLoading.set(false);
        },
        error: err => {
          this.output.set('');
          this.error.set(err.message);
          this.isLoading.set(false);
        }
      });
  }
}
