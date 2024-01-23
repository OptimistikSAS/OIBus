import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { OIBusCommandStatus } from '../../../../shared/model/command.model';

@Pipe({
  name: 'oibusCommandStatusEnum',
  pure: false,
  standalone: true
})
export class OibusCommandStatusEnumPipe extends BaseEnumPipe<OIBusCommandStatus> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'oibus-command-status');
  }
}
