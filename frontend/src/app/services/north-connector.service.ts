import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../shared/model/north-connector.model';

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
  getNorthConnectors(): Observable<Array<NorthConnectorDTO>> {
    return this.http.get<Array<NorthConnectorDTO>>(`/api/north`);
  }

  /**
   * Get one North connector
   * @param northId - the ID of the North connector
   */
  getNorthConnector(northId: string): Observable<NorthConnectorDTO> {
    return this.http.get<NorthConnectorDTO>(`/api/north/${northId}`);
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
  createNorthConnector(command: NorthConnectorCommandDTO): Observable<NorthConnectorDTO> {
    return this.http.post<NorthConnectorDTO>(`/api/north`, command);
  }

  /**
   * Update the selected North connector
   * @param northId - the ID of the North connector
   * @param command - the new values of the selected North connector
   */
  updateNorthConnector(northId: string, command: NorthConnectorCommandDTO) {
    return this.http.put<void>(`/api/north/${northId}`, command);
  }

  /**
   * Delete the selected North connector
   * @param northId - the ID of the North connector to delete
   */
  deleteNorthConnector(northId: string) {
    return this.http.delete<void>(`/api/north/${northId}`);
  }
}
