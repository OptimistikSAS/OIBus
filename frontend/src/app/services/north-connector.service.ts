import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import {
  NorthCacheFiles,
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../shared/model/north-connector.model';
import { ExternalSubscriptionDTO, SubscriptionDTO } from '../../../../shared/model/subscription.model';

/**
 * Service used to interact with the backend for CRUD operations on North connectors
 */
@Injectable({
  providedIn: 'root'
})
export class NorthConnectorService {
  constructor(private http: HttpClient) {}

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
  list(): Observable<Array<NorthConnectorDTO<any>>> {
    return this.http.get<Array<NorthConnectorDTO<any>>>(`/api/north`);
  }

  /**
   * Get one North connector
   * @param northId - the ID of the North connector
   */
  getNorthConnector(northId: string): Observable<NorthConnectorDTO<any>> {
    return this.http.get<NorthConnectorDTO<any>>(`/api/north/${northId}`);
  }

  /**
   * Get the schema of a North connector
   * @param type - the type of the North connector
   */
  getNorthConnectorSchema(type: string): Observable<object> {
    return this.http.get<object>(`/api/north-type/${type}`);
  }

  /**
   * Create a new North connector
   * @param command - the new North connector
   */
  createNorthConnector(command: NorthConnectorCommandDTO<any>): Observable<NorthConnectorDTO<any>> {
    return this.http.post<NorthConnectorDTO<any>>(`/api/north`, command);
  }

  /**
   * Update the selected North connector
   * @param northId - the ID of the North connector
   * @param command - the new values of the selected North connector
   */
  updateNorthConnector(northId: string, command: NorthConnectorCommandDTO<any>): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}`, command);
  }

  /**
   * Delete the selected North connector
   * @param northId - the ID of the North connector to delete
   */
  deleteNorthConnector(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}`);
  }

  /**
   * Retrieve the North connector subscriptions
   */
  getNorthConnectorSubscriptions(northId: string): Observable<Array<SubscriptionDTO>> {
    return this.http.get<Array<SubscriptionDTO>>(`/api/north/${northId}/subscriptions`);
  }

  /**
   * Create a new North connector subscription
   */
  createNorthConnectorSubscription(northId: string, southId: SubscriptionDTO): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/subscriptions/${southId}`, null);
  }

  /**
   * Delete the selected North connector subscription
   */
  deleteNorthConnectorSubscription(northId: string, southId: SubscriptionDTO): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/subscriptions/${southId}`);
  }

  /**
   * Retrieve the North connector external subscriptions
   */
  getNorthConnectorExternalSubscriptions(northId: string): Observable<Array<ExternalSubscriptionDTO>> {
    return this.http.get<Array<ExternalSubscriptionDTO>>(`/api/north/${northId}/external-subscriptions`);
  }

  /**
   * Create a new North connector external subscription
   */
  createNorthConnectorExternalSubscription(northId: string, externalSourceId: ExternalSubscriptionDTO): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/external-subscriptions/${externalSourceId}`, null);
  }

  /**
   * Delete the selected North connector external subscription
   */
  deleteNorthConnectorExternalSubscription(northId: string, externalSourceId: ExternalSubscriptionDTO): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/external-subscriptions/${externalSourceId}`);
  }

  getNorthConnectorCacheErrorFiles(northId: string): Observable<Array<NorthCacheFiles>> {
    return this.http.get<Array<NorthCacheFiles>>(`/api/north/${northId}/cache/file-errors`);
  }

  retryNorthConnectorCacheErrorFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/file-errors/retry`, filenames);
  }

  retryAllNorthConnectorCacheErrorFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/file-errors/retry-all`);
  }

  removeNorthConnectorCacheErrorFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/file-errors/remove`, filenames);
  }

  removeAllNorthConnectorCacheErrorFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/file-errors/remove-all`);
  }

  getNorthConnectorCacheArchiveFiles(northId: string): Observable<Array<NorthCacheFiles>> {
    return this.http.get<Array<NorthCacheFiles>>(`/api/north/${northId}/cache/archive-files`);
  }

  retryNorthConnectorCacheArchiveFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/archive-files/retry`, filenames);
  }

  retryAllNorthConnectorCacheArchiveFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/archive-files/retry-all`);
  }

  removeNorthConnectorCacheArchiveFiles(northId: string, filenames: Array<string>): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/archive-files/remove`, filenames);
  }

  removeAllNorthConnectorCacheArchiveFiles(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/cache/archive-files/remove-all`);
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

  testConnection(northId: string, settings: NorthConnectorCommandDTO<any>): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}/test-connection`, settings);
  }
}
