import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';
import { switchMap, finalize, tap } from 'rxjs/operators';
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

  private listTrigger$ = new BehaviorSubject<void>(undefined);
  private list$ = this.listTrigger$.pipe(
    switchMap(() => this.http.get<Array<TransformerDTO>>(`/api/transformers/list`)),
    shareReplay(1)
  );

  /**
   * Get the transformers
   */
  list(): Observable<Array<TransformerDTO>> {
    return this.list$;
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
    return this.http.post<TransformerDTO>(`/api/transformers`, command).pipe(tap(() => this.listTrigger$.next()));
  }

  /**
   * Update the selected transformer
   * @param transformerId - the ID of the transformer
   * @param command - the new values of the selected transformer
   */
  update(transformerId: string, command: CustomTransformerCommandDTO) {
    return this.http.put<void>(`/api/transformers/${transformerId}`, command).pipe(tap(() => this.listTrigger$.next()));
  }

  /**
   * Delete the selected transformer
   * @param transformerId - the ID of the transformer to delete
   */
  delete(transformerId: string) {
    return this.http.delete<void>(`/api/transformers/${transformerId}`).pipe(tap(() => this.listTrigger$.next()));
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
    return this.http.get<InputTemplate>(`/api/transformers/template/${inputType}`);
  }

  /**
   * Test a transformer definition by temporarily creating it
   * @param command - the transformer command to test
   * @param testRequest - the test request with input data and options
   */
  testDefinition(command: CustomTransformerCommandDTO, testRequest: TransformerTestRequest): Observable<TransformerTestResponse> {
    let transformerId: string;
    return this.create(command).pipe(
      switchMap(transformer => {
        transformerId = transformer.id;
        return this.test(transformer.id, testRequest);
      }),
      finalize(() => this.delete(transformerId!).subscribe())
    );
  }
}
