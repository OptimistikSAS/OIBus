import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { SerializationType } from '../../../../shared/model/types';

@Pipe({
  name: 'serializationsEnum',
  pure: false,
  standalone: true
})
export class SerializationsEnumPipe extends BaseEnumPipe<SerializationType> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'serialization-types');
  }
}
