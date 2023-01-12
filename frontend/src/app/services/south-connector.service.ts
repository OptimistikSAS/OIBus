import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorManifest,
  SouthItemCommandDTO,
  SouthItemDTO,
  SouthItemSearchParam,
  SouthType
} from '../model/south-connector.model';
import { Page } from '../shared/types';

/**
 * Service used to interact with the backend for CRUD operations on South connectors
 */
@Injectable({
  providedIn: 'root'
})
export class SouthConnectorService {
  constructor(private http: HttpClient) {}

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
   * Retrieve the South items from search params
   * @param southId - the ID of the South connector
   * @param searchParams - The search params
   */
  searchSouthItems(southId: string, searchParams: SouthItemSearchParam): Observable<Page<SouthItemDTO>> {
    const params: { [key: string]: string | string[] } = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.name) {
      params['name'] = searchParams.name;
    }
    return this.http.get<Page<SouthItemDTO>>(`/api/south/${southId}/items`, { params });
  }

  /**
   * Get a South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item
   */
  getSouthConnectorItem(southId: string, southItemId: string): Observable<SouthItemDTO> {
    return this.http.get<SouthItemDTO>(`/api/south/${southId}/items/${southItemId}`);
  }

  /**
   * Create a new South connector item
   * @param southId - the ID of the South connector
   * @param command - The values of the South connector item to create
   */
  createSouthItem(southId: string, command: SouthItemCommandDTO): Observable<SouthItemDTO> {
    return this.http.post<SouthItemDTO>(`/api/south/${southId}/items`, command);
  }

  /**
   * Update the selected South connector item
   * @param southId - the ID of the South connector
   * @param southItemId - the ID of the South connector item
   * @param command - the new values of the selected South connector item
   */
  updateSouthItem(southId: string, southItemId: string, command: SouthItemCommandDTO) {
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
}
