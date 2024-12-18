import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusSouthType } from '../../../../backend/shared/model/south-connector.model';

@Pipe({
  name: 'oIBusSouthTypeEnum',
  pure: false,
  standalone: true
})
export class OIBusSouthTypeEnumPipe extends BaseEnumPipe<OIBusSouthType> implements PipeTransform {
  constructor() {
    super('oibus-south-type');
  }
}
