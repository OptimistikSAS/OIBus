import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { Page } from '../../../../shared/model/types';
import { LogDTO, LogSearchParam, Scope } from '../../../../shared/model/logs.model';

/**
 * Service used to interact with the backend Log repository
 */
@Injectable({
  providedIn: 'root'
})
export class LogService {
  private http = inject(HttpClient);

  /**
   * Retrieve the Logs from search params
   * @param searchParams - The search params
   */
  searchLogs(searchParams: LogSearchParam): Observable<Page<LogDTO>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.messageContent) {
      params['messageContent'] = searchParams.messageContent;
    }
    if (searchParams.start) {
      params['start'] = searchParams.start;
    }
    if (searchParams.end) {
      params['end'] = searchParams.end;
    }
    if (searchParams.scopeTypes) {
      params['scopeTypes'] = searchParams.scopeTypes;
    }
    if (searchParams.scopeIds) {
      params['scopeIds'] = searchParams.scopeIds;
    }
    if (searchParams.levels) {
      params['levels'] = searchParams.levels;
    }
    return this.http.get<Page<LogDTO>>(`/api/logs`, { params });
  }

  suggestByScopeName(name: string): Observable<Array<Scope>> {
    return this.http.get<Array<Scope>>('/api/scope-logs/suggestions', { params: { name } });
  }

  getScopeById(id: string): Observable<Scope | null> {
    return this.http.get<Scope | null>(`/api/scope-logs/${id}`);
  }
}
