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
   * @param retrieveSecretsFromSouth - The source south (used to encrypt password in the backend)
   * @param retrieveSecretsFromNorth - The source north (used to encrypt password in the backend)
   * @param retrieveSecretsFromHistory - The ID of the duplicated History Query used to retrieved secrets in the backend
   */
  create(
    command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
    retrieveSecretsFromSouth: string | null,
    retrieveSecretsFromNorth: string | null,
    retrieveSecretsFromHistory: string | null
  ): Observable<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>> {
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
    return this.http.put<void>(`/api/history-queries/${historyQueryId}`, command, { params });
  }

  /**
   * Delete the selected History query
   * @param historyQueryId - the ID of the History query to delete
   */
  deleteHistoryQuery(historyQueryId: string) {
    return this.http.delete<void>(`/api/history-queries/${historyQueryId}`);
  }

  /**
   * Add or edit a History query transformer
   */
  addOrEditTransformer(historyQueryId: string, transformerWithOptions: TransformerDTOWithOptions): Observable<TransformerDTOWithOptions> {
    return this.http.put<TransformerDTOWithOptions>(`/api/history-queries/${historyQueryId}/transformers`, transformerWithOptions);
  }

  /**
   * Remove the selected History query transformer
   */
  removeTransformer(historyQueryId: string, transformerId: string): Observable<void> {
    return this.http.delete<void>(`/api/history-queries/${historyQueryId}/transformers/${transformerId}`);
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

  testSouthItem(
    historyId: string,
    southType: OIBusSouthType,
    itemName: string,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings
  ): Observable<OIBusContent> {
    return this.http.put<OIBusContent>(
      `/api/history-queries/${historyId}/south/items/test-item`,
      {
        southSettings,
        itemSettings,
        testingSettings
      },
      {
        params: { southType, itemName }
      }
    );
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
    southType: string,
    items: Array<HistoryQueryItemDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>>,
    fileName: string,
    delimiter: string
  ): Observable<void> {
    const formData = new FormData();
    // Convert the string to a Blob and append it as a file
    const currentItemsBlob = new Blob([JSON.stringify(items)], { type: 'text/plain' });
    formData.set('items', currentItemsBlob, 'items.json');
    formData.set('delimiter', delimiter);

    return this.http
      .put(`/api/history-queries/${southType}/south-items/to-csv`, formData, { responseType: 'blob', observe: 'response' })
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
      error: string;
    }>;
  }> {
    const formData = new FormData();
    formData.set('file', file);
    // Convert the string to a Blob and append it as a file
    const currentItemsBlob = new Blob([JSON.stringify(currentItems)], { type: 'text/plain' });
    formData.set('currentItems', currentItemsBlob, 'currentItems.txt');
    formData.set('delimiter', delimiter);
    return this.http.post<{
      items: Array<HistoryQueryItemDTO<SouthItemSettings>>;
      errors: Array<{ item: HistoryQueryItemDTO<SouthItemSettings>; error: string }>;
    }>(`/api/history-queries/${southType}/south-items/check-south-import/${historyQueryId}`, formData);
  }

  importItems(historyQueryId: string, items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>): Observable<void> {
    const formData = new FormData();
    // Convert the string to a Blob and append it as a file
    const itemsBlob = new Blob([JSON.stringify(items)], { type: 'text/plain' });
    formData.set('items', itemsBlob, 'items.json');
    return this.http.post<void>(`/api/history-queries/${historyQueryId}/south-items/import`, formData);
  }

  startHistoryQuery(historyQueryId: string): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/start`, null);
  }

  pauseHistoryQuery(historyQueryId: string): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/pause`, null);
  }

  testSouthConnection(
    historyQueryId: string,
    settings: SouthSettings,
    southType: OIBusSouthType,
    fromSouth: string | null = null
  ): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/south/test-connection`, settings, {
      params: fromSouth ? { fromSouth, southType } : { southType }
    });
  }

  testNorthConnection(
    historyQueryId: string,
    settings: NorthSettings,
    northType: OIBusNorthType,
    fromNorth: string | null = null
  ): Observable<void> {
    return this.http.put<void>(`/api/history-queries/${historyQueryId}/north/test-connection`, settings, {
      params: fromNorth ? { fromNorth, northType } : { northType }
    });
  }

  searchCacheContent(
    historyQueryId: string,
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
    return this.http.get<Array<{ metadataFilename: string; metadata: CacheMetadata }>>(
      `/api/history-query/${historyQueryId}/cache/content`,
      { params }
    );
  }

  getCacheFileContent(historyQueryId: string, folder: 'cache' | 'archive' | 'error', filename: string): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/history-query/${historyQueryId}/cache/content/${filename}`, {
      responseType: 'blob' as 'json',
      observe: 'response',
      params: {
        folder
      }
    });
  }

  removeCacheContent(historyQueryId: string, folder: 'cache' | 'archive' | 'error', filenames: Array<string>): Observable<void> {
    return this.http.delete<void>(`/api/history-query/${historyQueryId}/cache/content/remove`, {
      params: {
        folder
      },
      body: filenames
    });
  }

  removeAllCacheContent(historyQueryId: string, folder: 'cache' | 'archive' | 'error'): Observable<void> {
    return this.http.delete<void>(`/api/history-query/${historyQueryId}/cache/content/remove-all`, {
      params: {
        folder
      }
    });
  }

  moveCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    filenames: Array<string>
  ): Observable<void> {
    return this.http.post<void>(`/api/history-query/${historyQueryId}/cache/content/move`, filenames, {
      params: {
        originFolder,
        destinationFolder
      }
    });
  }

  moveAllCacheContent(
    historyQueryId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Observable<void> {
    return this.http.post<void>(`/api/history-query/${historyQueryId}/cache/content/move-all`, null, {
      params: {
        originFolder,
        destinationFolder
      }
    });
  }
}
