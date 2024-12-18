import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusSouthCategory } from '../../../../backend/shared/model/south-connector.model';

@Pipe({
  name: 'oIBusSouthCategoryEnum',
  pure: false,
  standalone: true
})
export class OIBusSouthCategoryEnumPipe extends BaseEnumPipe<OIBusSouthCategory> implements PipeTransform {
  constructor() {
    super('oibus-south-category');
  }
}
