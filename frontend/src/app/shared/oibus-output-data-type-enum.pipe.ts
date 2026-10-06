import { Pipe, PipeTransform } from '@angular/core';

import { OutputType } from '@oibus/shared/connector/transformer-manifest.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oIBusOutputDataTypeEnum',
  pure: false,
  standalone: true
})
export class OibusOutputDataTypeEnumPipe extends BaseEnumPipe<OutputType> implements PipeTransform {
  constructor() {
    super('oibus-output-data-type');
  }
}
