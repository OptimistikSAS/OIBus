import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { OIBusCommandStatus } from '../../../../backend/shared/model/command.model';

@Pipe({
  name: 'oibusCommandStatusEnum',
  pure: false,
  standalone: true
})
export class OibusCommandStatusEnumPipe extends BaseEnumPipe<OIBusCommandStatus> implements PipeTransform {
  constructor() {
    super('oibus-command-status');
  }
}
