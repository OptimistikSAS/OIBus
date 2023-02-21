import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { TranslateService } from '@ngx-translate/core';
import { AuthenticationType } from '../../../../shared/model/engine.model';

@Pipe({
  name: 'authTypesEnum',
  pure: false,
  standalone: true
})
export class AuthTypesEnumPipe extends BaseEnumPipe<AuthenticationType> implements PipeTransform {
  constructor(translateService: TranslateService) {
    super(translateService, 'auth-types');
  }
}
