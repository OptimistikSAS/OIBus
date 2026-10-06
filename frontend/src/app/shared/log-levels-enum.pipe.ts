import { Pipe, PipeTransform } from '@angular/core';

import { LogLevel } from '@oibus/shared/api/logs.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'logLevelsEnum',
  pure: false
})
export class LogLevelsEnumPipe extends BaseEnumPipe<LogLevel> implements PipeTransform {
  constructor() {
    super('log-levels');
  }
}
