import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { TransformerCommandDTO, TransformerDTO, TransformerFilterDTO } from '../../../../shared/model/transformer.model';

/**
 * Service used to interact with the backend for CRUD operations on transformers
 */
@Injectable({
  providedIn: 'root'
})
export class TransformerService {
  constructor(private http: HttpClient) {}

  /**
   * Get all transformers
   * @param filter Optionally filter them
   */
  list(
    filter: TransformerFilterDTO = {},
    forEntity: { northId: string } | { southId: string } | { historyId: string; connectorType: 'south' | 'north' } | undefined = undefined
  ): Observable<Array<TransformerDTO>> {
    if (!forEntity) {
      return this.http.get<Array<TransformerDTO>>(`/api/transformers`, { params: filter });
    }

    if ('northId' in forEntity) {
      const { northId } = forEntity;
      return this.http.get<Array<TransformerDTO>>(`/api/north/${northId}/transformers`, { params: filter });
    }

    if ('southId' in forEntity) {
      const { southId } = forEntity;
      return this.http.get<Array<TransformerDTO>>(`/api/north/${southId}/transformers`, { params: filter });
    }

    const { connectorType, historyId } = forEntity;
    return this.http.get<Array<TransformerDTO>>(`/api/history-queries/${historyId}/${connectorType}-transformers`, { params: filter });
  }

  /**
   * Get one transformer
   * @param transformerId - the ID of the transformer
   */
  get(transformerId: string): Observable<TransformerDTO> {
    return this.http.get<TransformerDTO>(`/api/transformers/${transformerId}`);
  }
  /**
   * Create a new transformer
   * @param command - the new transformer
   */
  create(
    command: TransformerCommandDTO,
    assignTo: { northId: string } | { southId: string } | { historyId: string; connectorType: 'south' | 'north' } | undefined = undefined
  ): Observable<TransformerDTO> {
    return this.http.post<TransformerDTO>(`/api/transformers`, command, { params: assignTo });
  }

  /**
   * Update the selected transformer
   * @param transformerId - the ID of the transformer
   * @param command - the new values of the selected transformer
   */
  update(transformerId: string, command: TransformerCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/transformers/${transformerId}`, command);
  }

  /**
   * Delete the selected transformer
   * @param transformerId - the ID of the transformer to delete
   */
  delete(transformerId: string): Observable<void> {
    return this.http.delete<void>(`/api/transformers/${transformerId}`);
  }

  /**
   * Assign one transformer to the given entity
   */
  assign(
    transformerId: string,
    forEntity: { northId: string } | { southId: string } | { historyId: string; connectorType: 'south' | 'north' }
  ): Observable<void> {
    if ('northId' in forEntity) {
      const { northId } = forEntity;
      return this.http.post<void>(`/api/north/${northId}/transformers/${transformerId}`, {});
    }

    if ('southId' in forEntity) {
      const { southId } = forEntity;
      return this.http.post<void>(`/api/north/${southId}/transformers/${transformerId}`, {});
    }

    const { connectorType, historyId } = forEntity;
    return this.http.post<void>(`/api/history-queries/${historyId}/${connectorType}-transformers/${transformerId}`, {});
  }

  /**
   * Unassign one transformer to the given entity
   */
  unassign(
    transformerId: string,
    forEntity: { northId: string } | { southId: string } | { historyId: string; connectorType: 'south' | 'north' }
  ): Observable<void> {
    if ('northId' in forEntity) {
      const { northId } = forEntity;
      return this.http.delete<void>(`/api/north/${northId}/transformers/${transformerId}`, {});
    }

    if ('southId' in forEntity) {
      const { southId } = forEntity;
      return this.http.delete<void>(`/api/north/${southId}/transformers/${transformerId}`, {});
    }

    const { connectorType, historyId } = forEntity;
    return this.http.delete<void>(`/api/history-queries/${historyId}/${connectorType}-transformers/${transformerId}`, {});
  }
}
