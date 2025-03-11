import { Component, forwardRef, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { BoxComponent } from '../../shared/box/box.component';
import { TransformerLightDTO } from '../../../../../backend/shared/model/transformer.model';
import { OIBusDataTypeEnumPipe } from '../../shared/oibus-data-type-enum.pipe';
import { OIBusDataType } from '../../../../../backend/shared/model/engine.model';
import { OibTransformerComponent } from '../../shared/form/oib-transformer/oib-transformer.component';
import { formDirectives } from '../../shared/form-directives';
import { FormArray, FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'oib-north-transformers',
  imports: [TranslateDirective, ...formDirectives, BoxComponent, OIBusDataTypeEnumPipe, OibTransformerComponent],
  templateUrl: './north-transformers.component.html',
  styleUrl: './north-transformers.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibTransformerComponent), multi: true }]
})
export class NorthTransformersComponent {
  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly transformers = input.required<Array<TransformerLightDTO>>();
  readonly controls = input.required<FormArray<FormGroup<{ type: FormControl<OIBusDataType>; transformer: FormControl<string> }>>>();
}
