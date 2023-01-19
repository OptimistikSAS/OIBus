import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { LogLevel } from '../model/engine.model';

@Pipe({
  name: 'logLevelsEnum',
  pure: false,
  standalone: true
})
export class LogLevelsEnumPipe extends BaseEnumPipe<LogLevel> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'log-levels');
  }
}
