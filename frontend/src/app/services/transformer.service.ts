import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { CustomTransformerCommand, TransformerDTO } from '../../../../backend/shared/model/transformer.model';

/**
 * Service used to interact with the backend for CRUD operations on Transformers
 */
@Injectable({
  providedIn: 'root'
})
export class TransformerService {
  private http = inject(HttpClient);

  /**
   * Get the transformers
   */
  list(): Observable<Array<TransformerDTO>> {
    return this.http.get<Array<TransformerDTO>>(`/api/transformers`);
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
  create(command: CustomTransformerCommand): Observable<TransformerDTO> {
    return this.http.post<TransformerDTO>(`/api/transformers`, command);
  }

  /**
   * Update the selected transformer
   * @param transformerId - the ID of the transformer
   * @param command - the new values of the selected transformer
   */
  update(transformerId: string, command: CustomTransformerCommand) {
    return this.http.put<void>(`/api/transformers/${transformerId}`, command);
  }

  /**
   * Delete the selected transformer
   * @param transformerId - the ID of the transformer to delete
   */
  delete(transformerId: string) {
    return this.http.delete<void>(`/api/transformers/${transformerId}`);
  }
}
