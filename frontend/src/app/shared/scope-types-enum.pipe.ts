import { Pipe, PipeTransform, inject } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { ScopeType } from '../../../../shared/model/engine.model';

@Pipe({
  name: 'scopeTypesEnum',
  pure: false,
  standalone: true
})
export class ScopeTypesEnumPipe extends BaseEnumPipe<ScopeType> implements PipeTransform {
  constructor() {
    const translateService = inject(TranslateService);

    super(translateService, 'scope-types');
  }
}
