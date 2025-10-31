import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { LogLevel } from '../../../../backend/shared/model/logs.model';

@Pipe({
  name: 'logLevelsEnum',
  pure: false
})
export class LogLevelsEnumPipe extends BaseEnumPipe<LogLevel> implements PipeTransform {
  constructor() {
    super('log-levels');
  }
}
