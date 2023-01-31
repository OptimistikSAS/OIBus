import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../../shared/model/history-query.model';

/**
 * Service used to interact with the backend for CRUD operations on History queries
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryQueryService {
  constructor(private http: HttpClient) {}

  /**
   * Get History queries
   */
  getHistoryQueries(): Observable<Array<HistoryQueryDTO>> {
    return this.http.get<Array<HistoryQueryDTO>>(`/api/history-queries`);
  }

  /**
   * Get one History query
   * @param historyQueryId - the ID of the History query
   */
  getHistoryQuery(historyQueryId: string): Observable<HistoryQueryDTO> {
    return this.http.get<HistoryQueryDTO>(`/api/history-queries/${historyQueryId}`);
  }

  /**
   * Create a new History query
   * @param command - the new History query
   */
  createHistoryQuery(command: HistoryQueryCommandDTO): Observable<HistoryQueryDTO> {
    return this.http.post<HistoryQueryDTO>(`/api/history-queries`, command);
  }

  /**
   * Update the selected History query
   * @param historyQueryId - the ID of the History query
   * @param command - the new values of the selected History query
   */
  updateHistoryQuery(historyQueryId: string, command: HistoryQueryCommandDTO) {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}`, command);
  }

  /**
   * Delete the selected History query
   * @param historyQueryId - the ID of the History query to delete
   */
  deleteHistoryQuery(historyQueryId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyQueryId}`);
  }
}
