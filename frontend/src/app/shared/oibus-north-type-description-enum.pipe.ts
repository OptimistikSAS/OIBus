import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusNorthType } from '@oibus/shared/north-connector.model';

@Pipe({
  name: 'oIBusNorthTypeDescriptionEnum',
  pure: false
})
export class OIBusNorthTypeDescriptionEnumPipe extends BaseEnumPipe<OIBusNorthType> implements PipeTransform {
  constructor() {
    super('oibus-north-type-description');
  }
}
