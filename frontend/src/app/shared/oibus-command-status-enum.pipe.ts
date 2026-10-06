import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusCommandStatus } from '@oibus/shared/command.model';

@Pipe({
  name: 'oibusCommandStatusEnum',
  pure: false
})
export class OibusCommandStatusEnumPipe extends BaseEnumPipe<OIBusCommandStatus> implements PipeTransform {
  constructor() {
    super('oibus-command-status');
  }
}
