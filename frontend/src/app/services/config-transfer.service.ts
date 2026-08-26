import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { from, map, Observable, switchMap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Service, inject } from '@angular/core';
import { ConfigImportResponseDTO } from '../../../../backend/shared/model/config-transfer.model';
import { DownloadService } from './download.service';
import { getMessageFromHttpErrorResponse, ignoreErrorIfStatusIs } from '../shared/error-interceptor.service';

const ENDPOINT = '/api/config-transfer';

const messageFromBody = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  const { message, error } = body as { message?: unknown; error?: unknown };
  // tsoa ValidateError puts a field map (not a string) in `message`
  if (typeof message === 'string') return message;
  if (typeof error === 'string') return error;
  return undefined;
};

/** Rethrows the message the backend put in the error body, falling back to the generic HTTP description. */
const rethrowServerMessage = (errorResponse: HttpErrorResponse): Observable<never> => {
  const fallback = getMessageFromHttpErrorResponse(errorResponse);
  if (errorResponse.error instanceof Blob) {
    // blob responseType: the JSON error body arrives unparsed
    return from(errorResponse.error.text()).pipe(
      switchMap(text => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = undefined;
        }
        return throwError(() => messageFromBody(parsed) ?? fallback);
      })
    );
  }
  return throwError(() => messageFromBody(errorResponse.error) ?? fallback);
};

/**
 * Service used to export and import a full, secret-free snapshot of the OIBus configuration
 */
@Service()
export class ConfigTransferService {
  private http = inject(HttpClient);
  private downloadService = inject(DownloadService);

  /**
   * Export the full OIBus configuration as a downloadable, secret-free, version-stamped JSON file
   */
  export(filename = 'oibus-config-export.json'): Observable<void> {
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);

    return this.http.get(`${ENDPOINT}/export`, { context, responseType: 'blob', observe: 'response' }).pipe(
      map(response => this.downloadService.download(response, filename)),
      catchError(rethrowServerMessage)
    );
  }

  /**
   * Import a previously exported configuration file, transactionally wiping and recreating every
   * in-scope section of the local configuration
   */
  import(file: File): Observable<ConfigImportResponseDTO> {
    const formData = new FormData();
    formData.set('file', file);

    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<ConfigImportResponseDTO>(`${ENDPOINT}/import`, formData, { context }).pipe(catchError(rethrowServerMessage));
  }
}
