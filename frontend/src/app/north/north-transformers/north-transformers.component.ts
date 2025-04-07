import { Component, forwardRef, inject, input } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { OibTransformerComponent } from '../../shared/form/oib-transformer/oib-transformer.component';
import { FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { ModalService } from '../../shared/modal.service';
import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal/edit-north-transformer-modal.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBUS_DATA_TYPES } from '../../../../../backend/shared/model/engine.model';

@Component({
  selector: 'oib-north-transformers',
  imports: [TranslateDirective, BoxComponent, ReactiveFormsModule, TranslatePipe, BoxTitleDirective, OibHelpComponent],
  templateUrl: './north-transformers.component.html',
  styleUrl: './north-transformers.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTransformerComponent), multi: true }]
})
export class NorthTransformersComponent {
  private modalService = inject(ModalService);

  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly transformers = input.required<Array<TransformerDTO>>();
  readonly control = input.required<FormControl<Array<TransformerDTOWithOptions>>>();

  createTransformer(e: Event) {
    e.preventDefault();
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, { size: 'xl' });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
    const usedTypes = this.control()
      .getRawValue()
      .map(element => element.inputType);
    component.prepareForCreation(
      OIBUS_DATA_TYPES.filter(dataType => !usedTypes.includes(dataType)),
      this.transformers(),
      this.northManifest().types
    );
    modalRef.result.subscribe((value: TransformerDTOWithOptions) => {
      const transformers = this.control().getRawValue();
      transformers.push(value);
      this.control().setValue([...transformers]);
    });
  }

  editTransformer(transformer: TransformerDTOWithOptions, index: number) {
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, { size: 'xl' });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
    component.prepareForEdition(transformer, this.transformers(), this.northManifest().types);
    modalRef.result.subscribe((value: TransformerDTOWithOptions) => {
      const transformers = this.control().getRawValue();
      transformers[index] = value;
      this.control().setValue([...transformers]);
    });
  }

  deleteTransformer(transformer: TransformerDTOWithOptions) {
    this.control().setValue([
      ...this.control()
        .getRawValue()
        .filter(
          element =>
            element.transformer.id !== transformer.transformer.id ||
            (element.transformer.id === transformer.transformer.id && element.inputType !== transformer.inputType)
        )
    ]);
  }
}
