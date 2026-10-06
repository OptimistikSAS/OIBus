import { Pipe, PipeTransform } from '@angular/core';

import { ScopeType } from '@oibus/shared/domain/logs.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'scopeTypesEnum',
  pure: false
})
export class ScopeTypesEnumPipe extends BaseEnumPipe<ScopeType> implements PipeTransform {
  constructor() {
    super('scope-types');
  }
}
