import { HttpClient, HttpResponse } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO
} from '../../../../backend/shared/model/history-query.model';
import { Page } from '../../../../backend/shared/model/types';
import { OIBusSouthType, SouthConnectorItemTestingSettings } from '../../../../backend/shared/model/south-connector.model';
import { DownloadService } from './download.service';
import { CacheMetadata, CacheSearchParam, OIBusContent } from '../../../../backend/shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../backend/shared/model/north-settings.model';
import { OIBusNorthType } from '../../../../backend/shared/model/north-connector.model';
import { TransformerDTOWithOptions } from '../../../../backend/shared/model/transformer.model';

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
    return this.http.get<Array<HistoryQueryLightDTO>>(`/api/history`);
  }

  /**
   * Get one History query
   * @param historyId - the ID of the History query
   */
  findById(historyId: string): Observable<HistoryQueryDTO> {
    return this.http.get<HistoryQueryDTO>(`/api/history/${historyId}`);
  }

  /**
   * Create a new History query
   * @param command - the new History query
   * @param retrieveSecretsFromSouth - The source south (used to encrypt password in the backend)
   * @param retrieveSecretsFromNorth - The source north (used to encrypt password in the backend)
   * @param retrieveSecretsFromHistory - The ID of the duplicated History Query used to retrieved secrets in the backend
   */
  create(
    command: HistoryQueryCommandDTO,
    retrieveSecretsFromSouth: string | null,
    retrieveSecretsFromNorth: string | null,
    retrieveSecretsFromHistory: string | null
  ): Observable<HistoryQueryDTO> {
    const params: Record<string, string | Array<string>> = {};
    if (retrieveSecretsFromHistory) {
      params['duplicate'] = retrieveSecretsFromHistory;
    }
    if (retrieveSecretsFromSouth) {
      params['fromSouth'] = retrieveSecretsFromSouth;
    }
    if (retrieveSecretsFromNorth) {
      params['fromNorth'] = retrieveSecretsFromNorth;
    }
    return this.http.post<HistoryQueryDTO>(`/api/history`, command, { params });
  }

  /**
   * Update the selected History query
   * @param historyId - the ID of the History query
   * @param command - the new values of the selected History query
   * @param resetCache - The user wants to reset the history cache to restart from scratch
   */
  update(historyId: string, command: HistoryQueryCommandDTO, resetCache: boolean) {
    const params: Record<string, string | Array<string>> = {};
    if (resetCache) {
      params['resetCache'] = resetCache.toString();
    }
    return this.http.put<void>(`/api/history/${historyId}`, command, { params });
  }

  /**
   * Delete the selected History query
   * @param historyId - the ID of the History query to delete
   */
  delete(historyId: string) {
    return this.http.delete<void>(`/api/history/${historyId}`);
  }

  start(historyId: string): Observable<void> {
    return this.http.post<void>(`/api/history/${historyId}/start`, null);
  }

  pause(historyId: string): Observable<void> {
    return this.http.post<void>(`/api/history/${historyId}/pause`, null);
  }

  testNorthConnection(
    historyId: string,
    settings: NorthSettings,
    northType: OIBusNorthType,
    fromNorth: string | null = null
  ): Observable<void> {
    return this.http.post<void>(`/api/history/${historyId}/test/north`, settings, {
      params: fromNorth ? { fromNorth, northType } : { northType }
    });
  }

  testSouthConnection(
    historyId: string,
    settings: SouthSettings,
    southType: OIBusSouthType,
    fromSouth: string | null = null
  ): Observable<void> {
    return this.http.post<void>(`/api/history/${historyId}/test/south`, settings, {
      params: fromSouth ? { fromSouth, southType } : { southType }
    });
  }

  testItem(
    historyId: string,
    fromSouth: string | null,
    southType: OIBusSouthType,
    itemName: string,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings
  ): Observable<OIBusContent> {
    return this.http.post<OIBusContent>(
      `/api/history/${historyId}/items/test`,
      {
        southSettings,
        itemSettings,
        testingSettings
      },
      {
        params: fromSouth ? { fromSouth, southType, itemName } : { southType, itemName }
      }
    );
  }

  /**
   * Retrieve the South items from search params
   * @param historyId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchItems(historyId: string, searchParams: HistoryQueryItemSearchParam): Observable<Page<HistoryQueryItemDTO>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<HistoryQueryItemDTO>>(`/api/history/${historyId}/items/search`, { params });
  }

  /**
   * Get a History query item
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item
   */
  getItem(historyId: string, itemId: string): Observable<HistoryQueryItemDTO> {
    return this.http.get<HistoryQueryItemDTO>(`/api/history/${historyId}/items/${itemId}`);
  }

  /**
   * Create a new History query item
   * @param historyId - the ID of the History query
   * @param command - The values of the History query item to create
   */
  createItem(historyId: string, command: HistoryQueryItemCommandDTO): Observable<HistoryQueryItemDTO> {
    return this.http.post<HistoryQueryItemDTO>(`/api/history/${historyId}/items`, command);
  }

  /**
   * Update the selected History query item
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item
   * @param command - the new values of the selected History query item
   */
  updateItem(historyId: string, itemId: string, command: HistoryQueryItemCommandDTO) {
    return this.http.put<void>(`/api/history/${historyId}/items/${itemId}`, command);
  }

  /**
   * Enable an item in the History query
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to enable
   */
  enableItem(historyId: string, itemId: string) {
    return this.http.post<void>(`/api/history/${historyId}/items/${itemId}/enable`, null);
  }

  /**
   * Disable an item in the History query
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to disable
   */
  disableItem(historyId: string, itemId: string) {
    return this.http.post<void>(`/api/history/${historyId}/items/${itemId}/disable`, null);
  }

  /**
   * Delete the selected History query item
   * @param historyId - the ID of the History query
   * @param itemId - the ID of the History query item to delete
   */
  deleteItem(historyId: string, itemId: string) {
    return this.http.delete<void>(`/api/history/${historyId}/items/${itemId}`);
  }

  /**
   * Enable multiple History query items
   * @param historyId - the ID of the History query
   * @param itemIds - array of item IDs to enable
   */
  enableItems(historyId: string, itemIds: Array<string>) {
    return this.http.post<void>(`/api/history/${historyId}/items/enable`, { itemIds });
  }

  /**
   * Disable multiple History query items
   * @param historyId - the ID of the History query
   * @param itemIds - array of item IDs to disable
   */
  disableItems(historyId: string, itemIds: Array<string>) {
    return this.http.post<void>(`/api/history/${historyId}/items/disable`, { itemIds });
  }

  /**
   * Delete multiple History query items
   * @param historyId - the ID of the History query
   * @param itemIds - array of item IDs to delete
   */
  deleteItems(historyId: string, itemIds: Array<string>) {
    return this.http.post<void>(`/api/history/${historyId}/items/delete`, { body: { itemIds } });
  }

  /**
   * Delete all items
   * @param historyId - the ID of the History Query connector
   */
  deleteAllItems(historyId: string) {
    return this.http.delete<void>(`/api/history/${historyId}/items`);
  }

  itemsToCsv(
    southType: string,
    items: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    filename: string,
    delimiter: string
  ): Observable<void> {
    const formData = new FormData();
    // Convert the string to a Blob and append it as a file
    formData.set('items', new Blob([JSON.stringify(items)], { type: 'application/json' }), 'items.json');
    formData.set('delimiter', delimiter);

    return this.http
      .post(`/api/history/${southType}/items/to-csv`, formData, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${filename}.csv`)));
  }

  exportItems(historyQueryId: string, fileName: string, delimiter: string): Observable<void> {
    return this.http
      .post(`/api/history/${historyQueryId}/items/export`, { delimiter }, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${fileName}.csv`)));
  }

  /**
   * Upload History Query items from a CSV file to check if they can be imported
   */
  checkImportItems(
    southType: string,
    currentItems: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    file: File,
    delimiter: string
  ): Observable<{
    items: Array<HistoryQueryItemDTO>;
    errors: Array<{
      item: HistoryQueryItemDTO;
      error: string;
    }>;
  }> {
    const formData = new FormData();
    formData.set('itemsToImport', file);
    // Convert the string to a Blob and append it as a file
    formData.set('currentItems', new Blob([JSON.stringify(currentItems)], { type: 'application/json' }), 'currentItems.json');
    formData.set('delimiter', delimiter);
    return this.http.post<{
      items: Array<HistoryQueryItemDTO>;
      errors: Array<{ item: HistoryQueryItemDTO; error: string }>;
    }>(`/api/history/${southType}/items/import/check`, formData);
  }

  importItems(historyId: string, items: Array<HistoryQueryItemCommandDTO>): Observable<void> {
    const formData = new FormData();
    // Convert the string to a Blob and append it as a file
    formData.set('items', new Blob([JSON.stringify(items)], { type: 'application/json' }), 'items.json');
    return this.http.post<void>(`/api/history/${historyId}/items/import`, formData);
  }

  /**
   * Add or edit a History query transformer
   */
  addOrEditTransformer(
    historyId: string,
    transformerWithOptions: Omit<TransformerDTOWithOptions, 'south'>
  ): Observable<Omit<TransformerDTOWithOptions, 'south'>> {
    return this.http.post<Omit<TransformerDTOWithOptions, 'south'>>(`/api/history/${historyId}/transformers`, transformerWithOptions);
  }

  /**
   * Remove the selected History query transformer
   */
  removeTransformer(historyId: string, transformerId: string): Observable<void> {
    return this.http.delete<void>(`/api/history/${historyId}/transformers/${transformerId}`);
  }

  searchCacheContent(
    historyId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Observable<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    const params: Record<string, string | Array<string>> = {
      folder
    };
    if (searchParams.start) {
      params['start'] = searchParams.start;
    }
    if (searchParams.end) {
      params['end'] = searchParams.end;
    }
    if (searchParams.nameContains) {
      params['nameContains'] = searchParams.nameContains;
    }
    return this.http.get<Array<{ metadataFilename: string; metadata: CacheMetadata }>>(`/api/history/${historyId}/cache/search`, {
      params
    });
  }

  getCacheFileContent(historyId: string, folder: 'cache' | 'archive' | 'error', filename: string): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/history/${historyId}/cache/content/${filename}`, {
      responseType: 'blob' as 'json',
      observe: 'response',
      params: {
        folder
      }
    });
  }

  removeCacheContent(historyId: string, folder: 'cache' | 'archive' | 'error', filenames: Array<string>): Observable<void> {
    return this.http.delete<void>(`/api/history/${historyId}/cache/remove`, {
      params: {
        folder
      },
      body: filenames
    });
  }

  removeAllCacheContent(historyId: string, folder: 'cache' | 'archive' | 'error'): Observable<void> {
    return this.http.delete<void>(`/api/history/${historyId}/cache/remove-all`, {
      params: {
        folder
      }
    });
  }

  moveCacheContent(
    historyId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    filenames: Array<string>
  ): Observable<void> {
    return this.http.post<void>(`/api/history/${historyId}/cache/move`, filenames, {
      params: {
        originFolder,
        destinationFolder
      }
    });
  }

  moveAllCacheContent(
    historyId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Observable<void> {
    return this.http.post<void>(`/api/history/${historyId}/cache/move-all`, null, {
      params: {
        originFolder,
        destinationFolder
      }
    });
  }
}
