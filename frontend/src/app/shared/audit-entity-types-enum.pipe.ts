import { Pipe, PipeTransform } from '@angular/core';
import { BaseEnumPipe } from './base-enum-pipe';
import { AuditEntityType } from '../../../../backend/shared/model/audit.model';

@Pipe({
  name: 'auditEntityTypesEnum',
  pure: false
})
export class AuditEntityTypesEnumPipe extends BaseEnumPipe<AuditEntityType> implements PipeTransform {
  constructor() {
    super('audit-entity-types');
  }
}
