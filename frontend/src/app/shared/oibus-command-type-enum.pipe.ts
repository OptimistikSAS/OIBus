import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusCommandType } from '../../../../backend/shared/model/command.model';

@Pipe({
  name: 'oibusCommandTypeEnum',
  pure: false
})
export class OibusCommandTypeEnumPipe extends BaseEnumPipe<OIBusCommandType> implements PipeTransform {
  constructor() {
    super('oibus-command-type');
  }
}
