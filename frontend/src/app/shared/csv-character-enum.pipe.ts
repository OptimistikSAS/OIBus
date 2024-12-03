import { Pipe, PipeTransform } from '@angular/core';
import { CsvCharacter } from '../../../../backend/shared/model/types';
import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'csvCharacterEnum',
  pure: false
})
export class CsvCharacterEnumPipe extends BaseEnumPipe<CsvCharacter> implements PipeTransform {
  constructor() {
    super('csv-character');
  }
}
