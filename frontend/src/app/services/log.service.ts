import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Service, inject } from '@angular/core';
import { Page } from '../../../../backend/shared/model/types';
import { Group, Item, LogDTO, LogSearchParam, Scope } from '../../../../backend/shared/model/logs.model';

/**
 * Service used to interact with the backend Log repository
 */
@Service()
export class LogService {
  private http = inject(HttpClient);

  /**
   * Retrieve the Logs from search params
   * @param searchParams - The search params
   */
  search(searchParams: LogSearchParam): Observable<Page<LogDTO>> {
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
      params['scopeTypes'] = searchParams.scopeTypes.join(',');
    }
    if (searchParams.scopeIds) {
      params['scopeIds'] = searchParams.scopeIds.join(',');
    }
    if (searchParams.itemIds) {
      params['itemIds'] = searchParams.itemIds.join(',');
    }
    if (searchParams.groupIds?.length) {
      params['groupIds'] = searchParams.groupIds.join(',');
    }
    if (searchParams.levels) {
      params['levels'] = searchParams.levels.join(',');
    }
    return this.http.get<Page<LogDTO>>(`/api/logs`, { params });
  }

  suggestScopes(name: string): Observable<Array<Scope>> {
    return this.http.get<Array<Scope>>('/api/logs/scopes/suggest', { params: { name } });
  }

  getScopeById(id: string): Observable<Scope | null> {
    return this.http.get<Scope | null>(`/api/logs/scopes/${id}`);
  }

  suggestItems(name: string): Observable<Array<Item>> {
    return this.http.get<Array<Item>>('/api/logs/items/suggest', { params: { name } });
  }

  getItemById(id: string): Observable<Item | null> {
    return this.http.get<Item | null>(`/api/logs/items/${id}`);
  }

  suggestGroups(name: string): Observable<Array<Group>> {
    return this.http.get<Array<Group>>('/api/logs/groups/suggest', { params: { name } });
  }

  getGroupById(id: string): Observable<Group | null> {
    return this.http.get<Group | null>(`/api/logs/groups/${id}`);
  }
}
