import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HistoryQueryCommandDTO, HistoryQueryCreateCommandDTO, HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { Page } from '../../../../shared/model/types';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam
} from '../../../../shared/model/south-connector.model';
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
  list(): Observable<Array<HistoryQueryDTO>> {
    return this.http.get<Array<HistoryQueryDTO>>(`/api/history-queries`);
  }

  /**
   * Get one History query
   * @param historyQueryId - the ID of the History query
   */
  get(historyQueryId: string): Observable<HistoryQueryDTO> {
    return this.http.get<HistoryQueryDTO>(`/api/history-queries/${historyQueryId}`);
  }

  /**
   * Create a new History query
   * @param command - the new History query
   */
  create(command: HistoryQueryCreateCommandDTO): Observable<HistoryQueryDTO> {
    return this.http.post<HistoryQueryDTO>(`/api/history-queries`, command);
  }

  /**
   * Update the selected History query
   * @param historyQueryId - the ID of the History query
   * @param command - the new values of the selected History query
   */
  update(historyQueryId: string, command: HistoryQueryCommandDTO) {
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
   * Retrieve all South items
   * @param southId - the ID of the South connector
   */
  listItems(southId: string): Observable<Array<SouthConnectorItemDTO<any>>> {
    return this.http.get<Array<SouthConnectorItemDTO<any>>>(`/api/history-queries/${southId}/items/all`);
  }

  /**
   * Retrieve the South items from search params
   * @param historyQueryId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchItems(historyQueryId: string, searchParams: SouthConnectorItemSearchParam): Observable<Page<SouthConnectorItemDTO<any>>> {
    const params: { [key: string]: string | string[] } = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<SouthConnectorItemDTO<any>>>(`/api/history-queries/${historyQueryId}/items`, { params });
  }

  /**
   * Get a History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item
   */
  getItem(historyQueryId: string, itemId: string): Observable<SouthConnectorItemDTO<any>> {
    return this.http.get<SouthConnectorItemDTO<any>>(`/api/history-queries/${historyQueryId}/items/${itemId}`);
  }

  /**
   * Create a new History query item
   * @param historyQueryId - the ID of the History query
   * @param command - The values of the History query item to create
   */
  createItem(historyQueryId: string, command: SouthConnectorItemCommandDTO<any>): Observable<SouthConnectorItemDTO<any>> {
    return this.http.post<SouthConnectorItemDTO<any>>(`/api/history-queries/${historyQueryId}/items`, command);
  }

  /**
   * Update the selected History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item
   * @param command - the new values of the selected History query item
   */
  updateItem(historyQueryId: string, itemId: string, command: SouthConnectorItemCommandDTO<any>) {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/items/${itemId}`, command);
  }

  /**
   * Delete the selected History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item to delete
   */
  deleteItem(historyQueryId: string, itemId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyQueryId}/items/${itemId}`);
  }

  /**
   * Enable an item in the History query
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to enable
   */
  enableItem(historyId: string, itemId: string) {
    return this.http.put<void>(`/api/history-queries/${historyId}/items/${itemId}/enable`, null);
  }

  /**
   * Disable an item in the History query
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to disable
   */
  disableItem(historyId: string, itemId: string) {
    return this.http.put<void>(`/api/history-queries/${historyId}/items/${itemId}/disable`, null);
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

  startHistoryQuery(historyQueryId: string): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/start`, null);
  }

  stopHistoryQuery(historyQueryId: string): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/stop`, null);
  }
}
