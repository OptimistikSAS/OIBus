import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OutputType } from '../../../../backend/shared/model/transformer.model';

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
