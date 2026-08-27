import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Service, inject } from '@angular/core';
import { ConfigImportEntityValidationError, ConfigImportResponseDTO } from '../../../../backend/shared/model/config-transfer.model';
import { DownloadService } from './download.service';
import {
  getMessageFromHttpErrorResponse,
  ignoreErrorIfStatusIs,
  messageFromBody,
  rethrowServerMessage
} from '../shared/error-interceptor.service';

const ENDPOINT = '/api/config-transfer';

/**
 * Thrown by `ConfigTransferService.import()` on a rejected import. Carries the per-entity
 * `validationErrors` the backend's `ConfigImportError` puts on a failed-validation response
 * (empty for every other rejection reason: malformed file, unsupported format version), so the
 * import modal can show which connector/field is actually at fault instead of a single opaque
 * message.
 */
export class ConfigImportFailure extends Error {
  constructor(
    message: string,
    readonly validationErrors: Array<ConfigImportEntityValidationError> = []
  ) {
    super(message);
    this.name = 'ConfigImportFailure';
  }
}

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
    return this.http
      .post<ConfigImportResponseDTO>(`${ENDPOINT}/import`, formData, { context })
      .pipe(catchError(errorResponse => this.rethrowImportFailure(errorResponse)));
  }

  /**
   * Unlike `export()` (a blob response, handled by the shared `rethrowServerMessage`), this is a
   * plain JSON request — Angular already parses a JSON error body onto `errorResponse.error`, so
   * `validationErrors` is read directly from it rather than needing the Blob-unwrapping `rethrowServerMessage` does.
   */
  private rethrowImportFailure(errorResponse: HttpErrorResponse): Observable<never> {
    const body = errorResponse.error as { validationErrors?: Array<ConfigImportEntityValidationError> } | null;
    const message = messageFromBody(errorResponse.error) ?? getMessageFromHttpErrorResponse(errorResponse);
    return throwError(() => new ConfigImportFailure(message, body?.validationErrors ?? []));
  }
}
