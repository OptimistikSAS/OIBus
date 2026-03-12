import { HttpClient } from '@angular/common/http';
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
import {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent
} from '../../../../backend/shared/model/engine.model';
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
  getNorthTypes(): Observable<Array<NorthType>> {
    return this.http.get<Array<NorthType>>(`/api/north/types`);
  }

  /**
   * Get a North connectors manifest
   */
  getNorthManifest(type: OIBusNorthType): Observable<NorthConnectorManifest> {
    return this.http.get<NorthConnectorManifest>(`/api/north/manifests/${type}`);
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
  findById(northId: string): Observable<NorthConnectorDTO> {
    return this.http.get<NorthConnectorDTO>(`/api/north/${northId}`);
  }

  /**
   * Create a new North connector
   * @param command - the new North connector
   * @param retrieveSecretsFromNorth - The ID of the duplicated North used to retrieved secrets in the backend
   */
  create(command: NorthConnectorCommandDTO, retrieveSecretsFromNorth: string): Observable<NorthConnectorDTO> {
    const params: Record<string, string | Array<string>> = {};
    if (retrieveSecretsFromNorth) {
      params['duplicate'] = retrieveSecretsFromNorth;
    }
    return this.http.post<NorthConnectorDTO>(`/api/north`, command, { params });
  }

  /**
   * Update the selected North connector
   * @param northId - the ID of the North connector
   * @param command - the new values of the selected North connector
   */
  update(northId: string, command: NorthConnectorCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}`, command);
  }

  /**
   * Delete the selected North connector
   * @param northId - the ID of the North connector to delete
   */
  delete(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}`);
  }

  start(northId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/start`, null);
  }

  stop(northId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/stop`, null);
  }

  /**
   * Reset the selected North metrics
   * @param northId - the ID of the North connector to reset
   */
  resetMetrics(northId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/metrics/reset`, null);
  }

  testConnection(northId: string, settings: NorthSettings, northType: OIBusNorthType): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/test/connection`, settings, {
      params: { northType }
    });
  }

  /**
   * Add or edit a North connector transformer
   */
  addOrEditTransformer(northId: string, transformerWithOptions: TransformerDTOWithOptions): Observable<TransformerDTOWithOptions> {
    return this.http.post<TransformerDTOWithOptions>(`/api/north/${northId}/transformers`, transformerWithOptions);
  }

  /**
   * Remove the selected North connector transformer
   */
  removeTransformer(northId: string, northTransformerId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/transformers/${northTransformerId}`);
  }

  /**
   * List files from north cache by search params
   */
  searchCacheContent(northId: string, searchParams: CacheSearchParam): Observable<CacheSearchResult> {
    const params: Record<string, number | string | Array<string>> = {
      maxNumberOfFilesReturned: searchParams.maxNumberOfFilesReturned
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
    return this.http.get<CacheSearchResult>(`/api/north/${northId}/cache/search`, { params });
  }

  /**
   * Retrieve file content from north cache
   */
  getCacheFileContent(northId: string, folder: DataFolderType, filename: string): Observable<FileCacheContent> {
    return this.http.get<FileCacheContent>(`/api/north/${northId}/cache/content/${filename}`, {
      params: {
        folder
      }
    });
  }

  /**
   * Update north cache content by moving or removing files from cache, archive and error folders
   */
  updateCacheContent(northId: string, updateCommand: CacheContentUpdateCommand): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/update`, updateCommand);
  }
}
