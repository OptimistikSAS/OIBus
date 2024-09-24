import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CsvCharacter } from '../../../../shared/model/types';
import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'csvCharacterEnum',
  pure: false,
  standalone: true
})
export class CsvCharacterEnumPipe extends BaseEnumPipe<CsvCharacter> implements PipeTransform {
  constructor() {
    const translateService = inject(TranslateService);

    super(translateService, 'csv-character');
  }
}
