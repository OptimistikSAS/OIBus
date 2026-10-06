import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusSouthType } from '@oibus/shared/south-connector.model';

@Pipe({
  name: 'oIBusSouthTypeDescriptionEnum',
  pure: false
})
export class OIBusSouthTypeDescriptionEnumPipe extends BaseEnumPipe<OIBusSouthType> implements PipeTransform {
  constructor() {
    super('oibus-south-type-description');
  }
}
