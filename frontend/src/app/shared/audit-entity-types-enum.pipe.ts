import { Pipe, PipeTransform } from '@angular/core';

import { AuditEntityType } from '@oibus/shared/api/audit.model';

import { BaseEnumPipe } from './base-enum-pipe';

@Pipe({
  name: 'auditEntityTypesEnum',
  pure: false
})
export class AuditEntityTypesEnumPipe extends BaseEnumPipe<AuditEntityType> implements PipeTransform {
  constructor() {
    super('audit-entity-types');
  }
}
