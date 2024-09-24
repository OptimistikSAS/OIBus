import { Pipe, PipeTransform, inject } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { SerializationType } from '../../../../shared/model/types';

@Pipe({
  name: 'serializationsEnum',
  pure: false,
  standalone: true
})
export class SerializationsEnumPipe extends BaseEnumPipe<SerializationType> implements PipeTransform {
  constructor() {
    const translateService = inject(TranslateService);

    super(translateService, 'serialization-types');
  }
}
