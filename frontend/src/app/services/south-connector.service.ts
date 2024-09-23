import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthType,
  SouthConnectorLightDTO
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import { DownloadService } from './download.service';
import { OIBusContent } from '../../../../shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';

/**
 * Service used to interact with the backend for CRUD operations on South connectors
 */
@Injectable({
  providedIn: 'root'
})
export class SouthConnectorService {
  private http = inject(HttpClient);
  private downloadService = inject(DownloadService);

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
  list(): Observable<Array<SouthConnectorLightDTO>> {
    return this.http.get<Array<SouthConnectorLightDTO>>(`/api/south`);
  }

  /**
   * Get one South connector
   * @param southId - the ID of the South connector
   */
  get(southId: string): Observable<SouthConnectorDTO<SouthSettings, SouthItemSettings>> {
    return this.http.get<SouthConnectorDTO<SouthSettings, SouthItemSettings>>(`/api/south/${southId}`);
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
   * @param duplicateId - The ID of the duplicated South used to retrieved secrets in the backend
   */
  create(
    command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    duplicateId: string
  ): Observable<SouthConnectorDTO<SouthSettings, SouthItemSettings>> {
    const params: Record<string, string | Array<string>> = {};
    if (duplicateId) {
      params['duplicateId'] = duplicateId;
    }
    return this.http.post<SouthConnectorDTO<SouthSettings, SouthItemSettings>>(`/api/south`, command, { params });
  }

  /**
   * Update the selected South connector
   * @param southId - the ID of the South connector
   * @param command - the new values of the selected South connector
   */
  update(southId: string, command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>) {
    return this.http.put<void>(`/api/south/${southId}`, command);
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
   * Retrieve the South items from search params
   * @param southId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Observable<Page<SouthConnectorItemDTO<any>>> {
    const params: Record<string, string | Array<string>> = {
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

  testItem(
    southId: string,
    south: SouthConnectorDTO<SouthSettings, SouthItemSettings> | null,
    item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>
  ): Observable<OIBusContent> {
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
  itemsToCsv(
    items: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>,
    fileName: string,
    delimiter: string
  ): Observable<void> {
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
   * Upload south items from a CSV file to check if they can be imported
   */
  checkImportItems(
    southType: string,
    southId: string,
    currentItems: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>,
    file: File,
    delimiter: string
  ): Observable<{
    items: Array<SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>>;
    errors: Array<{
      item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>;
      error: string;
    }>;
  }> {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('currentItems', JSON.stringify(currentItems));
    formData.set('delimiter', delimiter);
    return this.http.post<{
      items: Array<SouthConnectorItemDTO<SouthItemSettings>>;
      errors: Array<{ item: SouthConnectorItemDTO<SouthItemSettings>; error: string }>;
    }>(`/api/south/${southType}/items/check-import/${southId}`, formData);
  }

  /**
   * Upload south items from a CSV file
   */
  importItems(southId: string, items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>): Observable<void> {
    return this.http.post<void>(`/api/south/${southId}/items/import`, { items });
  }

  testConnection(southId: string, settings: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/test-connection`, settings);
  }

  startSouth(southId: string): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/start`, null);
  }

  stopSouth(southId: string): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/stop`, null);
  }
}
