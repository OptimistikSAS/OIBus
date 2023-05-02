import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HistoryQueryCommandDTO, HistoryQueryCreateCommandDTO, HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { Page } from '../../../../shared/model/types';
import { OibusItemCommandDTO, OibusItemDTO, OibusItemSearchParam } from '../../../../shared/model/south-connector.model';
import { DownloadService } from './download.service';
/**
 * Service used to interact with the backend for CRUD operations on History queries
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryQueryService {
  constructor(private http: HttpClient, private downloadService: DownloadService) {}

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
  createHistoryQuery(command: HistoryQueryCreateCommandDTO): Observable<HistoryQueryDTO> {
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

  /**
   * Retrieve the South items from search params
   * @param historyQueryId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchHistoryQueryItems(historyQueryId: string, searchParams: OibusItemSearchParam): Observable<Page<OibusItemDTO>> {
    const params: { [key: string]: string | string[] } = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<OibusItemDTO>>(`/api/history-queries/${historyQueryId}/items`, { params });
  }

  /**
   * Get a History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item
   */
  getSouthConnectorItem(historyQueryId: string, itemId: string): Observable<OibusItemDTO> {
    return this.http.get<OibusItemDTO>(`/api/history-queries/${historyQueryId}/items/${itemId}`);
  }

  /**
   * Create a new History query item
   * @param historyQueryId - the ID of the History query
   * @param command - The values of the History query item to create
   */
  createSouthItem(historyQueryId: string, command: OibusItemCommandDTO): Observable<OibusItemDTO> {
    return this.http.post<OibusItemDTO>(`/api/history-queries/${historyQueryId}/items`, command);
  }

  /**
   * Update the selected History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item
   * @param command - the new values of the selected History query item
   */
  updateSouthItem(historyQueryId: string, itemId: string, command: OibusItemCommandDTO) {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/items/${itemId}`, command);
  }

  /**
   * Delete the selected History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item to delete
   */
  deleteSouthItem(historyQueryId: string, itemId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyQueryId}/items/${itemId}`);
  }

  /**
   * Delete all items
   * @param historyId - the ID of the History Query connector
   */
  deleteAllItems(historyId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyId}/items/all`);
  }

  /**
   * Export items in CSV file
   */
  exportItems(historyQueryId: string, historyQueryName: string): Observable<void> {
    return this.http
      .get(`/api/history-queries/${historyQueryId}/items/export`, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${historyQueryName}.csv`)));
  }

  /**
   * Upload items from a CSV file
   */
  uploadItems(historyQueryId: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.set('file', file);
    return this.http.post<void>(`/api/history-queries/${historyQueryId}/items/upload`, formData);
  }
}
