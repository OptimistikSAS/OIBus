import { Pipe, PipeTransform } from '@angular/core';

import { OIBusCommandStatus } from '@oibus/shared/oia/command.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oibusCommandStatusEnum',
  pure: false
})
export class OibusCommandStatusEnumPipe extends BaseEnumPipe<OIBusCommandStatus> implements PipeTransform {
  constructor() {
    super('oibus-command-status');
  }
}
