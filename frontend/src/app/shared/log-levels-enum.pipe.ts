import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { LogLevel } from '../../../../backend/shared/model/engine.model';

@Pipe({
  name: 'logLevelsEnum',
  pure: false,
  standalone: true
})
export class LogLevelsEnumPipe extends BaseEnumPipe<LogLevel> implements PipeTransform {
  constructor() {
    super('log-levels');
  }
}
