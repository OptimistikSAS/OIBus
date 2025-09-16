import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { InputType } from '../../../../backend/shared/model/transformer.model';

@Pipe({
  name: 'oIBusInputDataTypeEnum',
  pure: false,
  standalone: true
})
export class OibusInputDataTypeEnumPipe extends BaseEnumPipe<InputType> implements PipeTransform {
  constructor() {
    super('oibus-input-data-type');
  }
}
