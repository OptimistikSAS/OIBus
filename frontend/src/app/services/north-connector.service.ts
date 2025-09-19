import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType,
  OIBusNorthType
} from '../../../../backend/shared/model/north-connector.model';
import { NorthSettings } from '../../../../backend/shared/model/north-settings.model';
import { CacheMetadata, CacheSearchParam } from '../../../../backend/shared/model/engine.model';
import { TransformerDTOWithOptions } from '../../../../backend/shared/model/transformer.model';

/**
 * Service used to interact with the backend for CRUD operations on North connectors
 */
@Injectable({
  providedIn: 'root'
})
export class NorthConnectorService {
  private http = inject(HttpClient);

  /**
   * Get North connectors types
   */
  getNorthConnectorTypes(): Observable<Array<NorthType>> {
    return this.http.get<Array<NorthType>>(`/api/north-types`);
  }

  /**
   * Get a North connectors manifest
   */
  getNorthConnectorTypeManifest(type: string): Observable<NorthConnectorManifest> {
    return this.http.get<NorthConnectorManifest>(`/api/north-types/${type}`);
  }

  /**
   * Get the North connectors
   */
  list(): Observable<Array<NorthConnectorLightDTO>> {
    return this.http.get<Array<NorthConnectorLightDTO>>(`/api/north`);
  }

  /**
   * Get one North connector
   * @param northId - the ID of the North connector
   */
  get(northId: string): Observable<NorthConnectorDTO<NorthSettings>> {
    return this.http.get<NorthConnectorDTO<NorthSettings>>(`/api/north/${northId}`);
  }

  /**
   * Get the schema of a North connector
   * @param type - the type of the North connector
   */
  getSchema(type: string): Observable<object> {
    return this.http.get<object>(`/api/north-type/${type}`);
  }

  /**
   * Create a new North connector
   * @param command - the new North connector
   * @param retrieveSecretsFromNorth - The ID of the duplicated North used to retrieved secrets in the backend
   */
  create(command: NorthConnectorCommandDTO<NorthSettings>, retrieveSecretsFromNorth: string): Observable<NorthConnectorDTO<any>> {
    const params: Record<string, string | Array<string>> = {};
    if (retrieveSecretsFromNorth) {
      params['duplicate'] = retrieveSecretsFromNorth;
    }
    return this.http.post<NorthConnectorDTO<NorthSettings>>(`/api/north`, command, { params });
  }

  /**
   * Update the selected North connector
   * @param northId - the ID of the North connector
   * @param command - the new values of the selected North connector
   */
  update(northId: string, command: NorthConnectorCommandDTO<NorthSettings>): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}`, command);
  }

  /**
   * Delete the selected North connector
   * @param northId - the ID of the North connector to delete
   */
  delete(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}`);
  }

  /**
   * Add a new North connector subscription
   */
  createSubscription(northId: string, southId: string): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/subscriptions/${southId}`, null);
  }

  /**
   * Delete the selected North connector subscription
   */
  deleteSubscription(northId: string, southId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/subscriptions/${southId}`);
  }

  /**
   * Add or edit a North connector transformer
   */
  addOrEditTransformer(northId: string, transformerWithOptions: TransformerDTOWithOptions): Observable<TransformerDTOWithOptions> {
    return this.http.put<TransformerDTOWithOptions>(`/api/north/${northId}/transformers`, transformerWithOptions);
  }

  /**
   * Remove the selected North connector transformer
   */
  removeTransformer(northId: string, transformerId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/transformers/${transformerId}`);
  }

  searchCacheContent(
    northId: string,
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
    return this.http.get<Array<{ metadataFilename: string; metadata: CacheMetadata }>>(`/api/north/${northId}/cache/content`, { params });
  }

  getCacheFileContent(northId: string, folder: 'cache' | 'archive' | 'error', filename: string): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/north/${northId}/cache/content/${filename}`, {
      responseType: 'blob' as 'json',
      observe: 'response',
      params: {
        folder
      }
    });
  }

  removeCacheContent(northId: string, folder: 'cache' | 'archive' | 'error', filenames: Array<string>): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/content/remove`, {
      params: {
        folder
      },
      body: filenames
    });
  }

  removeAllCacheContent(northId: string, folder: 'cache' | 'archive' | 'error'): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/content/remove-all`, {
      params: {
        folder
      }
    });
  }

  moveCacheContent(
    northId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    filenames: Array<string>
  ): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/content/move`, filenames, {
      params: {
        originFolder,
        destinationFolder
      }
    });
  }

  moveAllCacheContent(
    northId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/content/move-all`, null, {
      params: {
        originFolder,
        destinationFolder
      }
    });
  }

  /**
   * Reset the selected North metrics
   * @param northId - the ID of the North connector to reset
   */
  resetMetrics(northId: string): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/cache/reset-metrics`, null);
  }

  startNorth(northId: string): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/start`, null);
  }

  stopNorth(northId: string): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/stop`, null);
  }

  testConnection(northId: string, settings: NorthSettings, northType: OIBusNorthType): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/test-connection`, settings, {
      params: { northType }
    });
  }
}
