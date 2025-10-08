import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import {
  CustomTransformerCommandDTO,
  TransformerDTO,
  TransformerTestRequest,
  TransformerTestResponse,
  InputTemplate
} from '../../../../backend/shared/model/transformer.model';

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
    return this.http.get<Array<TransformerDTO>>(`/api/transformers/list`);
  }

  /**
   * Get one transformer
   * @param transformerId - the ID of the transformer
   */
  findById(transformerId: string): Observable<TransformerDTO> {
    return this.http.get<TransformerDTO>(`/api/transformers/${transformerId}`);
  }

  /**
   * Create a new transformer
   * @param command - the new transformer
   */
  create(command: CustomTransformerCommandDTO): Observable<TransformerDTO> {
    return this.http.post<TransformerDTO>(`/api/transformers`, command);
  }

  /**
   * Update the selected transformer
   * @param transformerId - the ID of the transformer
   * @param command - the new values of the selected transformer
   */
  update(transformerId: string, command: CustomTransformerCommandDTO) {
    return this.http.put<void>(`/api/transformers/${transformerId}`, command);
  }

  /**
   * Delete the selected transformer
   * @param transformerId - the ID of the transformer to delete
   */
  delete(transformerId: string) {
    return this.http.delete<void>(`/api/transformers/${transformerId}`);
  }

  /**
   * Test a custom transformer with input data
   * @param transformerId - the ID of the transformer to test
   * @param testRequest - the test request with input data and options
   */
  test(transformerId: string, testRequest: TransformerTestRequest): Observable<TransformerTestResponse> {
    return this.http.post<TransformerTestResponse>(`/api/transformers/${transformerId}/test`, testRequest);
  }

  /**
   * Get input template for a specific input type
   * @param inputType - the input type to get template for
   */
  getInputTemplate(inputType: string): Observable<InputTemplate> {
    return this.http.get<InputTemplate>(`/api/transformers/input-template?inputType=${inputType}`);
  }
}
