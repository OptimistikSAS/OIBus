import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusDataType } from '../../../../backend/shared/model/engine.model';

@Pipe({
  name: 'oIBusDataTypeEnum',
  pure: false,
  standalone: true
})
export class OIBusDataTypeEnumPipe extends BaseEnumPipe<OIBusDataType> implements PipeTransform {
  constructor() {
    super('oibus-data-type');
  }
}
