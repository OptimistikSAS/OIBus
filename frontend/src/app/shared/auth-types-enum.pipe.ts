import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { AuthenticationType } from '../../../../backend/shared/model/engine.model';

@Pipe({
  name: 'authTypesEnum',
  pure: false,
  standalone: true
})
export class AuthTypesEnumPipe extends BaseEnumPipe<AuthenticationType> implements PipeTransform {
  constructor() {
    super('auth-types');
  }
}
