import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TransformerLanguage } from '@oibus/shared/transformer.model';

@Pipe({
  name: 'oIBusTransformerLanguageEnum',
  pure: false
})
export class OIBusTransformerLanguageEnumPipe extends BaseEnumPipe<TransformerLanguage> implements PipeTransform {
  constructor() {
    super('oibus-transformer-language');
  }
}
