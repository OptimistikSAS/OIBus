import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusCommandType } from '../../../../shared/model/command.model';

@Pipe({
  name: 'oibusCommandTypeEnum',
  pure: false,
  standalone: true
})
export class OibusCommandTypeEnumPipe extends BaseEnumPipe<OIBusCommandType> implements PipeTransform {
  constructor() {
    super('oibus-command-type');
  }
}
