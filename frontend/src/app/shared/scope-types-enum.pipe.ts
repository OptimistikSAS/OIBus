import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { ScopeType } from '../../../../shared/model/engine.model';

@Pipe({
  name: 'scopeTypesEnum',
  pure: false,
  standalone: true
})
export class ScopeTypesEnumPipe extends BaseEnumPipe<ScopeType> implements PipeTransform {
  constructor() {
    super('scope-types');
  }
}
