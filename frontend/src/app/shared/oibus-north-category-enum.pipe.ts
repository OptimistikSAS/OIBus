import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusNorthCategory } from '../../../../backend/shared/model/north-connector.model';

@Pipe({
  name: 'oIBusNorthCategoryEnum',
  pure: false,
  standalone: true
})
export class OIBusNorthCategoryEnumPipe extends BaseEnumPipe<OIBusNorthCategory> implements PipeTransform {
  constructor() {
    super('oibus-north-category');
  }
}
