import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest,
  OibusItemCommandDTO,
  OibusItemDTO,
  OibusItemSearchParam,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import { DownloadService } from './download.service';

/**
 * Service used to interact with the backend for CRUD operations on South connectors
 */
@Injectable({
  providedIn: 'root'
})
export class SouthConnectorService {
  constructor(private http: HttpClient, private downloadService: DownloadService) {}

  /**
   * Get South connectors types
   */
  getSouthConnectorTypes(): Observable<Array<SouthType>> {
    return this.http.get<Array<SouthType>>(`/api/south-types`);
  }

  /**
   * Get a South connectors manifest
   */
  getSouthConnectorTypeManifest(type: string): Observable<SouthConnectorManifest> {
    return this.http.get<SouthConnectorManifest>(`/api/south-types/${type}`);
  }

  /**
   * Get the South connectors
   */
  getSouthConnectors(): Observable<Array<SouthConnectorDTO>> {
    return this.http.get<Array<SouthConnectorDTO>>(`/api/south`);
  }

  /**
   * Get one South connector
   * @param southId - the ID of the South connector
   */
  getSouthConnector(southId: string): Observable<SouthConnectorDTO> {
    return this.http.get<SouthConnectorDTO>(`/api/south/${southId}`);
  }

  /**
   * Get the schema of a South connector
   * @param type - the type of the South connector
   */
  getSouthConnectorSchema(type: string): Observable<object> {
    return this.http.get<object>(`/api/south-type/${type}`);
  }

  /**
   * Create a new South connector
   * @param command - the new South connector
   */
  createSouthConnector(command: SouthConnectorCommandDTO): Observable<SouthConnectorDTO> {
    return this.http.post<SouthConnectorDTO>(`/api/south`, command);
  }

  /**
   * Update the selected South connector
   * @param southId - the ID of the South connector
   * @param command - the new values of the selected South connector
   */
  updateSouthConnector(southId: string, command: SouthConnectorCommandDTO) {
    return this.http.put<void>(`/api/south/${southId}`, command);
  }

  /**
   * Delete the selected South connector
   * @param southId - the ID of the South connector to delete
   */
  deleteSouthConnector(southId: string) {
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
  searchSouthItems(southId: string, searchParams: OibusItemSearchParam): Observable<Page<OibusItemDTO>> {
    const params: { [key: string]: string | string[] } = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<OibusItemDTO>>(`/api/south/${southId}/items`, { params });
  }

  /**
   * Get a South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item
   */
  getSouthConnectorItem(southId: string, southItemId: string): Observable<OibusItemDTO> {
    return this.http.get<OibusItemDTO>(`/api/south/${southId}/items/${southItemId}`);
  }

  /**
   * Create a new South connector item
   * @param southId - the ID of the South connector
   * @param command - The values of the South connector item to create
   */
  createSouthItem(southId: string, command: OibusItemCommandDTO): Observable<OibusItemDTO> {
    return this.http.post<OibusItemDTO>(`/api/south/${southId}/items`, command);
  }

  /**
   * Update the selected South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item
   * @param command - the new values of the selected South connector item
   */
  updateSouthItem(southId: string, southItemId: string, command: OibusItemCommandDTO) {
    return this.http.put<void>(`/api/south/${southId}/items/${southItemId}`, command);
  }

  /**
   * Delete the selected South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item to delete
   */
  deleteSouthItem(southId: string, southItemId: string) {
    return this.http.delete<void>(`/api/south/${southId}/items/${southItemId}`);
  }

  /**
   * Export south items in CSV file
   */
  exportItems(southId: string, southName: string): Observable<void> {
    return this.http
      .get(`/api/south/${southId}/items/export`, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, `${southName}.csv`)));
  }

  /**
   * Upload south items from a CSV file
   */
  uploadItems(southId: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.set('file', file);
    return this.http.post<void>(`/api/south/${southId}/items/upload`, formData);
  }
}
