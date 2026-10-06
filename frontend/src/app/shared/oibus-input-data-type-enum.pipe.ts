import { Pipe, PipeTransform } from '@angular/core';

import { InputType } from '@oibus/shared/connector/transformer-manifest.model';

import { BaseEnumPipe } from './base-enum-pipe';

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
