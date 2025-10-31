import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorItemTestingSettings,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthType
} from '../../../../backend/shared/model/south-connector.model';
import { Page } from '../../../../backend/shared/model/types';
import { DownloadService } from './download.service';
import { OIBusContent } from '../../../../backend/shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../../backend/shared/model/south-settings.model';

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
   * Get South connectors manifests
   */
  getSouthTypes(): Observable<Array<SouthType>> {
    return this.http.get<Array<SouthType>>(`/api/south/types`);
  }

  /**
   * Get a South connector manifest
   */
  getSouthManifest(type: string): Observable<SouthConnectorManifest> {
    return this.http.get<SouthConnectorManifest>(`/api/south/manifests/${type}`);
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
  findById(southId: string): Observable<SouthConnectorDTO<SouthSettings, SouthItemSettings>> {
    return this.http.get<SouthConnectorDTO<SouthSettings, SouthItemSettings>>(`/api/south/${southId}`);
  }

  /**
   * Create a new South connector
   * @param command - the new South connector
   * @param retrieveSecretsFromSouth - The ID of the duplicated South used to retrieved secrets in the backend
   */
  create(
    command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>,
    retrieveSecretsFromSouth: string
  ): Observable<SouthConnectorDTO<SouthSettings, SouthItemSettings>> {
    const params: Record<string, string | Array<string>> = {};
    if (retrieveSecretsFromSouth) {
      params['duplicate'] = retrieveSecretsFromSouth;
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

  start(southId: string): Observable<void> {
    return this.http.post<void>(`/api/south/${southId}/start`, null);
  }

  stop(southId: string): Observable<void> {
    return this.http.post<void>(`/api/south/${southId}/stop`, null);
  }

  /**
   * Reset the selected South metrics
   * @param southId - the ID of the South connector to reset
   */
  resetMetrics(southId: string): Observable<void> {
    return this.http.put<void>(`/api/south/${southId}/metrics/reset`, null);
  }

  testConnection(southId: string, settings: SouthSettings, southType: OIBusSouthType): Observable<void> {
    return this.http.post<void>(`/api/south/${southId}/test/connection`, settings, {
      params: { southType }
    });
  }

  testItem(
    southId: string,
    southType: OIBusSouthType,
    itemName: string,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings
  ): Observable<OIBusContent> {
    return this.http.post<OIBusContent>(
      `/api/south/${southId}/test/item`,
      { southSettings, itemSettings, testingSettings },
      {
        params: { southType, itemName }
      }
    );
  }

  /**
   * Retrieve the South items from search params
   * @param southId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Observable<Page<SouthConnectorItemDTO<SouthItemSettings>>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<SouthConnectorItemDTO<SouthItemSettings>>>(`/api/south/${southId}/items/search`, { params });
  }

  /**
   * Get a South connector item
   * @param southId - the ID of the South connector
   * @param itemId - the ID of the South connector item
   */
  getItem(southId: string, itemId: string): Observable<SouthConnectorItemDTO<SouthItemSettings>> {
    return this.http.get<SouthConnectorItemDTO<SouthItemSettings>>(`/api/south/${southId}/items/${itemId}`);
  }

  /**
   * Create a new South connector item
   * @param southId - the ID of the South connector
   * @param command - The values of the South connector item to create
   */
  createItem(
    southId: string,
    command: SouthConnectorItemCommandDTO<SouthItemSettings>
  ): Observable<SouthConnectorItemDTO<SouthItemSettings>> {
    return this.http.post<SouthConnectorItemDTO<SouthItemSettings>>(`/api/south/${southId}/items`, command);
  }

  /**
   * Update the selected South connector item
   * @param southId - the ID of the South connector
   * @param itemId - the ID of the South connector item
   * @param command - the new values of the selected South connector item
   */
  updateItem(southId: string, itemId: string, command: SouthConnectorItemCommandDTO<SouthItemSettings>) {
    return this.http.put<void>(`/api/south/${southId}/items/${itemId}`, command);
  }

  /**
   * Delete the selected South connector item
   * @param southId - the ID of the South connector
   * @param itemId - the ID of the South connector item to delete
   */
  deleteItem(southId: string, itemId: string) {
    return this.http.delete<void>(`/api/south/${southId}/items/${itemId}`);
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
    return this.http.delete<void>(`/api/south/${southId}/items`);
  }

  /**
   * Export south items in CSV file
   */
  itemsToCsv(
    southType: string,
    items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>,
    filename: string,
    delimiter: string
  ): Observable<void> {
    const formData = new FormData();
    // Convert the string to a Blob and append it as a file
    formData.set('items', new Blob([JSON.stringify(items)], { type: 'application/json' }), 'items.json');
    formData.set('delimiter', delimiter);

    return this.http
      .post(`/api/south/${southType}/items/to-csv`, formData, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${filename}.csv`)));
  }

  /**
   * Export south items in CSV file
   */
  exportItems(southId: string, filename: string, delimiter: string): Observable<void> {
    return this.http
      .post(`/api/south/${southId}/items/export`, { delimiter }, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${filename}.csv`)));
  }

  /**
   * Upload south items from a CSV file to check if they can be imported
   */
  checkImportItems(
    southType: string,
    currentItems: Array<SouthConnectorItemDTO<SouthItemSettings>>,
    file: File,
    delimiter: string
  ): Observable<{
    items: Array<SouthConnectorItemDTO<SouthItemSettings>>;
    errors: Array<{
      item: Record<string, string>;
      error: string;
    }>;
  }> {
    const formData = new FormData();
    formData.set('itemsToImport', file);
    // Convert the current items to a Blob and append it as a file
    formData.set('currentItems', new Blob([JSON.stringify(currentItems)], { type: 'application/json' }), 'currentItems.json');
    formData.set('delimiter', delimiter);
    return this.http.post<{
      items: Array<SouthConnectorItemDTO<SouthItemSettings>>;
      errors: Array<{ item: Record<string, string>; error: string }>;
    }>(`/api/south/${southType}/items/import/check`, formData);
  }

  importItems(southId: string, items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>): Observable<void> {
    const formData = new FormData();
    // Convert the string to a Blob and append it as a file
    formData.set('items', new Blob([JSON.stringify(items)], { type: 'application/json' }), 'items.json');

    return this.http.post<void>(`/api/south/${southId}/items/import`, formData);
  }
}
