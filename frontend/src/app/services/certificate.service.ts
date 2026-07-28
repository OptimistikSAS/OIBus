import { HttpClient, HttpErrorResponse, HttpParams, HttpStatusCode } from '@angular/common/http';
import { BehaviorSubject, from, map, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Service, inject } from '@angular/core';
import { CertificateCommandDTO, CertificateDTO, CertificateExportFormat } from '../../../../backend/shared/model/certificate.model';
import { DownloadService } from './download.service';
import { getMessageFromHttpErrorResponse, ignoreErrorIfStatusIs } from '../shared/error-interceptor.service';

const ENDPOINT = '/api/certificates';

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
 * Service used to interact with the backend for CRUD operations on Certificates
 */
@Service()
export class CertificateService {
  private http = inject(HttpClient);
  private downloadService = inject(DownloadService);

  private listTrigger$ = new BehaviorSubject<void>(undefined);
  private list$ = this.listTrigger$.pipe(
    switchMap(() => this.http.get<Array<CertificateDTO>>(ENDPOINT)),
    shareReplay(1)
  );

  /**
   * Get the certificates
   */
  list(): Observable<Array<CertificateDTO>> {
    return this.list$;
  }

  findById(certificateId: string): Observable<CertificateDTO> {
    return this.http.get<CertificateDTO>(`${ENDPOINT}/${certificateId}`);
  }

  create(command: CertificateCommandDTO): Observable<CertificateDTO> {
    return this.http.post<CertificateDTO>(`${ENDPOINT}`, command).pipe(tap(() => this.listTrigger$.next()));
  }

  update(certificateId: string, command: CertificateCommandDTO) {
    return this.http.put<void>(`${ENDPOINT}/${certificateId}`, command).pipe(tap(() => this.listTrigger$.next()));
  }

  delete(certificateId: string) {
    return this.http.delete<void>(`${ENDPOINT}/${certificateId}`).pipe(tap(() => this.listTrigger$.next()));
  }

  /**
   * Import a certificate from a certificate file, a private key file and an optional CA chain file
   */
  importCertificate(
    command: { name: string; description: string; privateKeyPassphrase: string | null },
    files: { certificate: File; privateKey: File; certificateChain: File | null }
  ): Observable<CertificateDTO> {
    const formData = new FormData();
    formData.set('certificate', files.certificate);
    formData.set('privateKey', files.privateKey);
    if (files.certificateChain) {
      formData.set('certificateChain', files.certificateChain);
    }
    formData.set('name', command.name);
    formData.set('description', command.description);
    if (command.privateKeyPassphrase) {
      formData.set('privateKeyPassphrase', command.privateKeyPassphrase);
    }

    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<CertificateDTO>(`${ENDPOINT}/import`, formData, { context }).pipe(
      tap(() => this.listTrigger$.next()),
      catchError(rethrowServerMessage)
    );
  }

  /**
   * Export a certificate (and optionally its CA chain) in the given format
   */
  exportCertificate(certificateId: string, format: CertificateExportFormat, includeChain: boolean, filename: string): Observable<void> {
    const params = new HttpParams().set('format', format).set('includeChain', includeChain);
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);

    return this.http.get(`${ENDPOINT}/${certificateId}/export`, { params, context, responseType: 'blob', observe: 'response' }).pipe(
      map(response => this.downloadService.download(response, filename)),
      catchError(rethrowServerMessage)
    );
  }

  /**
   * Export the encrypted private key of a certificate
   */
  exportPrivateKey(certificateId: string, passphrase: string, filename: string): Observable<void> {
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http
      .post(`${ENDPOINT}/${certificateId}/export/private-key`, { passphrase }, { context, responseType: 'blob', observe: 'response' })
      .pipe(
        map(response => this.downloadService.download(response, filename)),
        catchError(rethrowServerMessage)
      );
  }
}
