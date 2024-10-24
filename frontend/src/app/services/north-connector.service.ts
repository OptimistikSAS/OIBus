import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import {
  NorthCacheFiles,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType,
  NorthValueFiles
} from '../../../../backend/shared/model/north-connector.model';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { NorthSettings } from '../../../../backend/shared/model/north-settings.model';

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
   * @param duplicateId - The ID of the duplicated North used to retrieved secrets in the backend
   */
  create(command: NorthConnectorCommandDTO<NorthSettings>, duplicateId: string): Observable<NorthConnectorDTO<any>> {
    const params: Record<string, string | Array<string>> = {};
    if (duplicateId) {
      params['duplicateId'] = duplicateId;
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
   * Retrieve the North connector subscriptions
   */
  getSubscriptions(northId: string): Observable<Array<SouthConnectorLightDTO>> {
    return this.http.get<Array<SouthConnectorLightDTO>>(`/api/north/${northId}/subscriptions`);
  }

  /**
   * Create a new North connector subscription
   */
  createSubscription(northId: string, southId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/subscriptions/${southId}`, null);
  }

  /**
   * Delete the selected North connector subscription
   */
  deleteSubscription(northId: string, southId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/subscriptions/${southId}`);
  }

  getCacheErrorFiles(northId: string): Observable<Array<NorthCacheFiles>> {
    return this.http.get<Array<NorthCacheFiles>>(`/api/north/${northId}/cache/file-errors`);
  }

  getCacheErrorFileContent(northId: string, filename: string): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/north/${northId}/cache/file-errors/${filename}`, {
      responseType: 'blob' as 'json',
      observe: 'response'
    });
  }

  retryCacheErrorFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/file-errors/retry`, filenames);
  }

  retryAllCacheErrorFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/file-errors/retry-all`);
  }

  removeCacheErrorFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/file-errors/remove`, filenames);
  }

  removeAllCacheErrorFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/file-errors/remove-all`);
  }

  getCacheFiles(northId: string): Observable<Array<NorthCacheFiles>> {
    return this.http.get<Array<NorthCacheFiles>>(`/api/north/${northId}/cache/files`);
  }

  getCacheFileContent(northId: string, filename: string): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/north/${northId}/cache/files/${filename}`, {
      responseType: 'blob' as 'json',
      observe: 'response'
    });
  }

  removeCacheFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/files/remove`, filenames);
  }

  archiveCacheFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/files/archive`, filenames);
  }

  getCacheArchiveFiles(northId: string): Observable<Array<NorthCacheFiles>> {
    return this.http.get<Array<NorthCacheFiles>>(`/api/north/${northId}/cache/archive-files`);
  }

  getCacheArchiveFileContent(northId: string, filename: string): Observable<HttpResponse<Blob>> {
    return this.http.get<Blob>(`/api/north/${northId}/cache/archive-files/${filename}`, {
      responseType: 'blob' as 'json',
      observe: 'response'
    });
  }

  retryCacheArchiveFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/archive-files/retry`, filenames);
  }

  retryAllCacheArchiveFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/archive-files/retry-all`);
  }

  removeCacheArchiveFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/archive-files/remove`, filenames);
  }

  removeAllCacheArchiveFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/archive-files/remove-all`);
  }

  getCacheValues(northId: string): Observable<Array<NorthValueFiles>> {
    return this.http.get<Array<NorthValueFiles>>(`/api/north/${northId}/cache/values`);
  }

  removeCacheValues(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/values/remove`, filenames);
  }

  getCacheErrorValues(northId: string): Observable<Array<NorthCacheFiles>> {
    return this.http.get<Array<NorthCacheFiles>>(`/api/north/${northId}/cache/value-errors`);
  }

  removeCacheErrorValues(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/value-errors/remove`, filenames);
  }

  retryCacheErrorValues(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/value-errors/retry`, filenames);
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

  testConnection(northId: string, settings: NorthConnectorCommandDTO<NorthSettings>): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/test-connection`, settings);
  }
}
