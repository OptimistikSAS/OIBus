import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { SerializationType } from '../../../../backend/shared/model/types';

@Pipe({
  name: 'serializationsEnum',
  pure: false
})
export class SerializationsEnumPipe extends BaseEnumPipe<SerializationType> implements PipeTransform {
  constructor() {
    super('serialization-types');
  }
}
