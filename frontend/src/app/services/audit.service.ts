import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

import { Observable } from 'rxjs';

import { AuditAction, AuditEntityType, AuditLogDTO } from '@oibus/shared/api/audit.model';
import { Page } from '@oibus/shared/common/types';

export interface AuditSearchParam {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  start?: string;
  end?: string;
  page?: number;
}

/**
 * Service used to interact with the backend Audit repository
 */
@Service()
export class AuditService {
  private http = inject(HttpClient);

  /**
   * Retrieve the Audit logs from search params
   * @param searchParams - The search params
   */
  search(searchParams: AuditSearchParam): Observable<Page<AuditLogDTO>> {
    const params: Record<string, string> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.entityType) {
      params['entityType'] = searchParams.entityType;
    }
    if (searchParams.entityId) {
      params['entityId'] = searchParams.entityId;
    }
    if (searchParams.action) {
      params['action'] = searchParams.action;
    }
    if (searchParams.start) {
      params['start'] = searchParams.start;
    }
    if (searchParams.end) {
      params['end'] = searchParams.end;
    }
    return this.http.get<Page<AuditLogDTO>>('/api/audit', { params });
  }

  /**
   * Retrieve the full audit history for a single entity
   */
  getHistory(entityType: AuditEntityType, entityId: string): Observable<Array<AuditLogDTO>> {
    return this.http.get<Array<AuditLogDTO>>(`/api/audit/${entityType}/${entityId}`);
  }
}
