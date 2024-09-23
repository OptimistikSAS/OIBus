import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO
} from '../../../../shared/model/history-query.model';
import { Page } from '../../../../shared/model/types';
import { SouthConnectorCommandDTO } from '../../../../shared/model/south-connector.model';
import { DownloadService } from './download.service';
import { NorthConnectorCommandDTO } from '../../../../shared/model/north-connector.model';
import { OIBusContent } from '../../../../shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';

/**
 * Service used to interact with the backend for CRUD operations on History queries
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryQueryService {
  private http = inject(HttpClient);
  private downloadService = inject(DownloadService);

  /**
   * Get History queries
   */
  list(): Observable<Array<HistoryQueryLightDTO>> {
    return this.http.get<Array<HistoryQueryLightDTO>>(`/api/history-queries`);
  }

  /**
   * Get one History query
   * @param historyQueryId - the ID of the History query
   */
  get(historyQueryId: string): Observable<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>> {
    return this.http.get<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>(`/api/history-queries/${historyQueryId}`);
  }

  /**
   * Create a new History query
   * @param command - the new History query
   * @param fromSouthId - The source south (used to encrypt password in the backend)
   * @param fromNorthId - The source north (used to encrypt password in the backend)
   * @param duplicateId - The ID of the duplicated History Query used to retrieved secrets in the backend
   */
  create(
    command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
    fromSouthId: string | null,
    fromNorthId: string | null,
    duplicateId: string
  ): Observable<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>> {
    const params: Record<string, string | Array<string>> = {};
    if (duplicateId) {
      params['duplicateId'] = duplicateId;
    }
    if (fromSouthId) {
      params['fromSouthId'] = fromSouthId;
    }
    if (fromNorthId) {
      params['fromNorthId'] = fromNorthId;
    }
    return this.http.post<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>(`/api/history-queries`, command, { params });
  }

  /**
   * Update the selected History query
   * @param historyQueryId - the ID of the History query
   * @param command - the new values of the selected History query
   * @param resetCache - The user wants to reset the history cache to restart from scratch
   */
  update(historyQueryId: string, command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>, resetCache: boolean) {
    const params: Record<string, string | Array<string>> = {};
    if (resetCache) {
      params['resetCache'] = resetCache.toString();
    }
    return this.http.put<void>(`/api/history-queries/${historyQueryId}`, command, params);
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
  searchItems(historyQueryId: string, searchParams: HistoryQueryItemSearchParam): Observable<Page<HistoryQueryItemDTO<SouthItemSettings>>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<HistoryQueryItemDTO<SouthItemSettings>>>(`/api/history-queries/${historyQueryId}/south-items`, { params });
  }

  /**
   * Get a History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item
   */
  getItem(historyQueryId: string, itemId: string): Observable<HistoryQueryItemDTO<SouthItemSettings>> {
    return this.http.get<HistoryQueryItemDTO<SouthItemSettings>>(`/api/history-queries/${historyQueryId}/south-items/${itemId}`);
  }

  /**
   * Create a new History query item
   * @param historyQueryId - the ID of the History query
   * @param command - The values of the History query item to create
   */
  createItem(historyQueryId: string, command: HistoryQueryItemCommandDTO<SouthItemSettings>): Observable<HistoryQueryItemDTO<any>> {
    return this.http.post<HistoryQueryItemDTO<SouthItemSettings>>(`/api/history-queries/${historyQueryId}/south-items`, command);
  }

  /**
   * Update the selected History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item
   * @param command - the new values of the selected History query item
   */
  updateItem(historyQueryId: string, itemId: string, command: HistoryQueryItemCommandDTO<SouthItemSettings>) {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/south-items/${itemId}`, command);
  }

  /**
   * Delete the selected History query item
   * @param historyQueryId - the ID of the History query
   * @param itemId - the ID of the History query item to delete
   */
  deleteItem(historyQueryId: string, itemId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyQueryId}/south-items/${itemId}`);
  }

  /**
   * Enable an item in the History query
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to enable
   */
  enableItem(historyId: string, itemId: string) {
    return this.http.put<void>(`/api/history-queries/${historyId}/south-items/${itemId}/enable`, null);
  }

  /**
   * Disable an item in the History query
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to disable
   */
  disableItem(historyId: string, itemId: string) {
    return this.http.put<void>(`/api/history-queries/${historyId}/south-items/${itemId}/disable`, null);
  }

  /**
   * Delete all items
   * @param historyId - the ID of the History Query connector
   */
  deleteAllItems(historyId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyId}/south-items/all`);
  }

  testItem(
    historyId: string,
    historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> | null,
    item: HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>
  ): Observable<OIBusContent> {
    return this.http.put<OIBusContent>(`/api/history-queries/${historyId}/items/test-item`, { historyQuery, item });
  }

  /**
   * Export items in CSV file
   */
  exportItems(historyQueryId: string, fileName: string, delimiter: string): Observable<void> {
    return this.http
      .put(`/api/history-queries/${historyQueryId}/south-items/export`, { delimiter }, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${fileName}.csv`)));
  }

  itemsToCsv(
    items: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    fileName: string,
    delimiter: string
  ): Observable<void> {
    return this.http
      .put(
        `/api/history-queries/south-items/to-csv`,
        {
          items,
          delimiter
        },
        { responseType: 'blob', observe: 'response' }
      )
      .pipe(map(response => this.downloadService.download(response, `${fileName}.csv`)));
  }

  /**
   * Upload History Query items from a CSV file to check if they can be imported
   */
  checkImportItems(
    southType: string,
    historyQueryId: string,
    currentItems: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    file: File,
    delimiter: string
  ): Observable<{
    items: Array<HistoryQueryItemDTO<SouthItemSettings>>;
    errors: Array<{
      item: HistoryQueryItemDTO<SouthItemSettings>;
      message: string;
    }>;
  }> {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('currentItems', JSON.stringify(currentItems));
    formData.set('delimiter', delimiter);
    return this.http.post<{
      items: Array<HistoryQueryItemDTO<SouthItemSettings>>;
      errors: Array<{ item: HistoryQueryItemDTO<SouthItemSettings>; message: string }>;
    }>(`/api/history-queries/${southType}/south-items/check-south-import/${historyQueryId}`, formData);
  }

  /**
   * Upload south history items from a CSV file
   */
  importItems(historyQueryId: string, items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>): Observable<void> {
    return this.http.post<void>(`/api/history-queries/${historyQueryId}/south-items/import`, { items });
  }

  startHistoryQuery(historyQueryId: string): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/start`, null);
  }

  pauseHistoryQuery(historyQueryId: string): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/pause`, null);
  }

  testSouthConnection(
    historyQueryId: string,
    settings: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    fromConnectorId: string | null = null
  ): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/south/test-connection`, settings, {
      params: fromConnectorId ? { fromConnectorId } : {}
    });
  }

  testNorthConnection(
    historyQueryId: string,
    settings: NorthConnectorCommandDTO<NorthSettings>,
    fromConnectorId: string | null = null
  ): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/north/test-connection`, settings, {
      params: fromConnectorId ? { fromConnectorId } : {}
    });
  }
}
