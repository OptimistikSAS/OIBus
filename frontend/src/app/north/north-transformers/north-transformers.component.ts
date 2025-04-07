import { Component, forwardRef, inject, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { BoxComponent } from '../../shared/box/box.component';
import { TransformerLightDTO } from '../../../../../backend/shared/model/transformer.model';
import { OibTransformerComponent } from '../../shared/form/oib-transformer/oib-transformer.component';
import { FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ModalService } from '../../shared/modal.service';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal/edit-north-transformer-modal.component';

@Component({
  selector: 'oib-north-transformers',
  imports: [TranslateDirective, BoxComponent],
  templateUrl: './north-transformers.component.html',
  styleUrl: './north-transformers.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTransformerComponent), multi: true }]
})
export class NorthTransformersComponent {
  private modalService = inject(ModalService);

  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly transformers = input.required<Array<TransformerLightDTO>>();
  readonly controls = input.required<
    FormGroup<{
      unknown: FormGroup<{ transformer: FormControl<TransformerLightDTO | null>; options: FormControl<object> }>;
      timeValues: FormGroup<{ transformer: FormControl<TransformerLightDTO | null>; options: FormControl<object> }>;
    }>
  >();

  editTransformer(inputType: string) {
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, { size: 'xl' });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
    const transformer =
      inputType === 'time-values'
        ? this.controls().getRawValue().timeValues.transformer
        : this.controls().getRawValue().unknown.transformer;
    const options =
      inputType === 'time-values' ? this.controls().getRawValue().timeValues.options : this.controls().getRawValue().unknown.options;
    component.prepare(inputType, this.transformers(), this.northManifest().types, transformer, options);
    modalRef.result.subscribe((value: { transformer: TransformerLightDTO | null; options: object }) => {
      if (inputType === 'time-values') {
        this.controls().controls.timeValues.setValue({
          transformer: value.transformer,
          options: value.options
        });
      } else {
        this.controls().controls.unknown.setValue({
          transformer: value.transformer,
          options: value.options
        });
      }
    });
  }
}
