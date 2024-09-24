import { Injectable, PipeTransform } from '@angular/core';
import { CsvCharacterEnumPipe } from '../csv-character-enum.pipe';
import { DatetimeTypesEnumPipe } from '../datetime-types-enum.pipe';
import { AuthTypesEnumPipe } from '../auth-types-enum.pipe';
import { AggregatesEnumPipe } from '../aggregates-enum.pipe';
import { ResamplingEnumPipe } from '../resampling-enum.pipe';

@Injectable({
  providedIn: 'root'
})
export class PipeProviderService {
  private readonly PIPES: Map<string, PipeTransform> = new Map<string, PipeTransform>();

  constructor() {
    this.PIPES.set('character', new CsvCharacterEnumPipe());
    this.PIPES.set('dateTimeType', new DatetimeTypesEnumPipe());
    this.PIPES.set('authentication', new AuthTypesEnumPipe());
    this.PIPES.set('aggregates', new AggregatesEnumPipe());
    this.PIPES.set('resampling', new ResamplingEnumPipe());
  }

  getPipeForString(pipeIdentifier: string): PipeTransform {
    return this.PIPES.get(pipeIdentifier)!;
  }

  validIdentifier(pipeIdentifier: string): boolean {
    return this.PIPES.has(pipeIdentifier);
  }
}
