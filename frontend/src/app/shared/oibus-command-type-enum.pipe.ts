import { Pipe, PipeTransform } from '@angular/core';

import { OIBusCommandType } from '@oibus/shared/oia/command.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oibusCommandTypeEnum',
  pure: false
})
export class OibusCommandTypeEnumPipe extends BaseEnumPipe<OIBusCommandType> implements PipeTransform {
  constructor() {
    super('oibus-command-type');
  }
}
