import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import { DownloadService } from './download.service';
import { OIBusContent } from '../../../../shared/model/engine.model';

/**
 * Service used to interact with the backend for CRUD operations on South connectors
 */
@Injectable({
  providedIn: 'root'
})
export class SouthConnectorService {
  constructor(
    private http: HttpClient,
    private downloadService: DownloadService
  ) {}

  /**
   * Get South connectors types
   */
  getAvailableTypes(): Observable<Array<SouthType>> {
    return this.http.get<Array<SouthType>>(`/api/south-types`);
  }

  /**
   * Get a South connector manifest
   */
  getSouthConnectorTypeManifest(type: string): Observable<SouthConnectorManifest> {
    return this.http.get<SouthConnectorManifest>(`/api/south-types/${type}`);
  }

  /**
   * Get the South connectors
   */
  list(): Observable<Array<SouthConnectorDTO<any>>> {
    return this.http.get<Array<SouthConnectorDTO<any>>>(`/api/south`);
  }

  /**
   * Get one South connector
   * @param southId - the ID of the South connector
   */
  get(southId: string): Observable<SouthConnectorDTO<any>> {
    return this.http.get<SouthConnectorDTO<any>>(`/api/south/${southId}`);
  }

  /**
   * Get the schema of a South connector
   * @param type - the type of the South connector
   */
  getSchema(type: string): Observable<object> {
    return this.http.get<object>(`/api/south-type/${type}`);
  }

  /**
   * Create a new South connector
   * @param command - the new South connector
   * @param items - the new South connector items
   * @param duplicateId - The ID of the duplicated South used to retrieved secrets in the backend
   */
  create(
    command: SouthConnectorCommandDTO<any>,
    items: Array<SouthConnectorItemDTO<any>>,
    duplicateId: string
  ): Observable<SouthConnectorDTO<any>> {
    const params: { [key: string]: string | string[] } = {};
    if (duplicateId) {
      params['duplicateId'] = duplicateId;
    }
    return this.http.post<SouthConnectorDTO<any>>(`/api/south`, { south: command, items }, { params });
  }

  /**
   * Update the selected South connector
   * @param southId - the ID of the South connector
   * @param command - the new values of the selected South connector
   * @param items - The items to create or update
   * @param itemIdsToDelete - The item ids to delete
   */
  update(
    southId: string,
    command: SouthConnectorCommandDTO<any>,
    items: Array<SouthConnectorItemDTO<any>>,
    itemIdsToDelete: Array<string>
  ) {
    return this.http.put<void>(`/api/south/${southId}`, { south: command, items, itemIdsToDelete });
  }

  /**
   * Delete the selected South connector
   * @param southId - the ID of the South connector to delete
   */
  delete(southId: string) {
    return this.http.delete<void>(`/api/south/${southId}`);
  }

  /**
   * Reset the selected South metrics
   * @param southId - the ID of the South connector to reset
   */
  resetMetrics(southId: string): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/cache/reset-metrics`, null);
  }

  /**
   * Retrieve all South items
   * @param southId - the ID of the South connector
   */
  listItems(southId: string): Observable<Array<SouthConnectorItemDTO<any>>> {
    return this.http.get<Array<SouthConnectorItemDTO<any>>>(`/api/south/${southId}/items/all`);
  }

  /**
   * Retrieve the South items from search params
   * @param southId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Observable<Page<SouthConnectorItemDTO<any>>> {
    const params: { [key: string]: string | string[] } = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<SouthConnectorItemDTO<any>>>(`/api/south/${southId}/items`, { params });
  }

  /**
   * Get a South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item
   */
  getItem(southId: string, southItemId: string): Observable<SouthConnectorItemDTO<any>> {
    return this.http.get<SouthConnectorItemDTO<any>>(`/api/south/${southId}/items/${southItemId}`);
  }

  /**
   * Create a new South connector item
   * @param southId - the ID of the South connector
   * @param command - The values of the South connector item to create
   */
  createItem(southId: string, command: SouthConnectorItemCommandDTO<any>): Observable<SouthConnectorItemDTO<any>> {
    return this.http.post<SouthConnectorItemDTO<any>>(`/api/south/${southId}/items`, command);
  }

  /**
   * Update the selected South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item
   * @param command - the new values of the selected South connector item
   */
  updateItem(southId: string, southItemId: string, command: SouthConnectorItemCommandDTO<any>) {
    return this.http.put<void>(`/api/south/${southId}/items/${southItemId}`, command);
  }

  /**
   * Delete the selected South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item to delete
   */
  deleteItem(southId: string, southItemId: string) {
    return this.http.delete<void>(`/api/south/${southId}/items/${southItemId}`);
  }

  /**
   * Enable an item in the South connector
   * @param southId - the ID of the South connector
   * @param itemId - the ID of the South connector item to enable
   */
  enableItem(southId: string, itemId: string) {
    return this.http.put<void>(`/api/south/${southId}/items/${itemId}/enable`, null);
  }

  /**
   * Disable an item in the South connector
   * @param southId - the ID of the South connector
   * @param itemId - the ID of the South connector item to disable
   */
  disableItem(southId: string, itemId: string) {
    return this.http.put<void>(`/api/south/${southId}/items/${itemId}/disable`, null);
  }

  /**
   * Delete all South items
   * @param southId - the ID of the South connector
   */
  deleteAllItems(southId: string) {
    return this.http.delete<void>(`/api/south/${southId}/items/all`);
  }

  testItems(southId: string, south: SouthConnectorCommandDTO | null, item: SouthConnectorItemDTO): Observable<OIBusContent> {
    return this.http.put<OIBusContent>(`/api/south/${southId}/items/test-item`, { south: south, item: item });
  }

  /**
   * Export south items in CSV file
   */
  exportItems(southId: string, fileName: string, delimiter: string): Observable<void> {
    return this.http
      .put(`/api/south/${southId}/items/export`, { delimiter }, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${fileName}.csv`)));
  }

  /**
   * Export south items in CSV file
   */
  itemsToCsv(items: Array<SouthConnectorItemDTO>, fileName: string, delimiter: string): Observable<void> {
    return this.http
      .put(
        `/api/south/items/to-csv`,
        {
          items,
          delimiter
        },
        { responseType: 'blob', observe: 'response' }
      )
      .pipe(map(response => this.downloadService.download(response, `${fileName}.csv`)));
  }

  /**
   * Upload south items from a CSV file
   */
  checkImportItems(
    southType: string,
    southId: string,
    file: File,
    itemIdsToDelete: Array<string>,
    delimiter: string
  ): Observable<{
    items: Array<SouthConnectorItemDTO>;
    errors: Array<{
      item: SouthConnectorItemDTO;
      message: string;
    }>;
  }> {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('itemIdsToDelete', JSON.stringify(itemIdsToDelete));
    formData.set('delimiter', delimiter);
    return this.http.post<{ items: Array<SouthConnectorItemDTO>; errors: Array<{ item: SouthConnectorItemDTO; message: string }> }>(
      `/api/south/${southType}/items/check-import/${southId}`,
      formData
    );
  }

  /**
   * Upload south items from a CSV file
   */
  importItems(southId: string, items: Array<SouthConnectorItemDTO>): Observable<void> {
    return this.http.post<void>(`/api/south/${southId}/items/import`, { items });
  }

  testConnection(southId: string, settings: SouthConnectorCommandDTO<any>): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/test-connection`, settings);
  }

  startSouth(southId: string): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/start`, null);
  }

  stopSouth(southId: string): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/stop`, null);
  }
}
