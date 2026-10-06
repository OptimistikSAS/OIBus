import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusNorthType } from '@oibus/shared/north-connector.model';

@Pipe({
  name: 'oIBusNorthTypeEnum',
  pure: false
})
export class OIBusNorthTypeEnumPipe extends BaseEnumPipe<OIBusNorthType> implements PipeTransform {
  constructor() {
    super('oibus-north-type');
  }
}
