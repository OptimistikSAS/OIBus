import { Pipe, PipeTransform } from '@angular/core';

import { TransformerLanguage } from '@oibus/shared/domain/transformer.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'oIBusTransformerLanguageEnum',
  pure: false
})
export class OIBusTransformerLanguageEnumPipe extends BaseEnumPipe<TransformerLanguage> implements PipeTransform {
  constructor() {
    super('oibus-transformer-language');
  }
}
