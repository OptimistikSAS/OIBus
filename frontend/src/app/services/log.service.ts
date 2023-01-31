import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { Page } from '../../../../shared/model/types';
import { LogDTO, LogSearchParam } from '../../../../shared/model/logs.model';

/**
 * Service used to interact with the backend Log repository
 */
@Injectable({
  providedIn: 'root'
})
export class LogService {
  constructor(private http: HttpClient) {}

  /**
   * Retrieve the Logs from search params
   * @param searchParams - The search params
   */
  searchLogs(searchParams: LogSearchParam): Observable<Page<LogDTO>> {
    const params: { [key: string]: string | string[] } = {
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
    if (searchParams.scope) {
      params['scope'] = searchParams.scope;
    }
    if (searchParams.levels) {
      params['levels'] = searchParams.levels;
    }
    return this.http.get<Page<LogDTO>>(`/api/logs`, { params });
  }
}
