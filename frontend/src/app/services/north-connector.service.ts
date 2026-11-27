import { HttpClient, HttpContext, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';

import { Observable, tap } from 'rxjs';

import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { ServerTrustCommandDTO, ServerTrustStateDTO } from '@oibus/shared/api/server-identity.model';
import { TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { NorthConnectorManifest, NorthType, OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { NorthSettings } from '@oibus/shared/connector/north-settings.model';
import {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  NorthConnectorMetrics,
  OIBusConnectionTestResult
} from '@oibus/shared/domain/engine.model';
import { PresentedServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { ignoreErrorUnlessStatusIs, SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { FormServerTrustService } from '../shared/server-trust/form-server-trust.service';
import { CertificateService } from './certificate.service';

/**
 * Service used to interact with the backend for CRUD operations on North connectors
 */
@Service()
export class NorthConnectorService {
  private readonly http = inject(HttpClient);
  private readonly certificateService = inject(CertificateService);
  private readonly formServerTrust = inject(FormServerTrustService);

  /**
   * Get North connectors types
   */
  getNorthTypes(): Observable<Array<NorthType>> {
    return this.http.get<Array<NorthType>>(`/api/north/types`);
  }

  /**
   * Get a North connectors manifest
   */
  getNorthManifest(type: OIBusNorthType): Observable<NorthConnectorManifest> {
    return this.http.get<NorthConnectorManifest>(`/api/north/manifests/${type}`);
  }

  /**
   * Get the North connectors
   */
  list(): Observable<Array<NorthConnectorLightDTO>> {
    return this.http.get<Array<NorthConnectorLightDTO>>(`/api/north`);
  }

  /**
   * Get one North connector
   * @param northId - the ID of the North connector
   */
  findById(northId: string): Observable<NorthConnectorDTO> {
    return this.http.get<NorthConnectorDTO>(`/api/north/${northId}`);
  }

  /**
   * Create a new North connector
   * @param command - the new North connector
   * @param retrieveSecretsFromNorth - The ID of the duplicated North used to retrieved secrets in the backend
   */
  create(command: NorthConnectorCommandDTO, retrieveSecretsFromNorth: string): Observable<NorthConnectorDTO> {
    const params: Record<string, string | Array<string>> = {};
    if (retrieveSecretsFromNorth) {
      params['duplicate'] = retrieveSecretsFromNorth;
    }
    return this.http
      .post<NorthConnectorDTO>(`/api/north`, command, { params })
      .pipe(tap(() => this.refreshCertificatesWhenTrusting(command.serverTrust)));
  }

  /**
   * Update the selected North connector
   * @param northId - the ID of the North connector
   * @param command - the new values of the selected North connector
   */
  update(northId: string, command: NorthConnectorCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/north/${northId}`, command).pipe(tap(() => this.refreshCertificatesWhenTrusting(command.serverTrust)));
  }

  /**
   * Delete the selected North connector
   * @param northId - the ID of the North connector to delete
   */
  delete(northId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}`);
  }

  start(northId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/start`, null);
  }

  stop(northId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/stop`, null);
  }

  /**
   * Reset the selected North metrics
   * @param northId - the ID of the North connector to reset
   */
  resetMetrics(northId: string): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/metrics/reset`, null);
  }

  /**
   * Get the current metrics of the selected North. Polled in the background, so only an expired session is notified
   * @param northId - the ID of the North connector
   */
  getMetrics(northId: string): Observable<NorthConnectorMetrics> {
    return this.http.get<NorthConnectorMetrics>(`/api/north/${northId}/metrics`, {
      context: ignoreErrorUnlessStatusIs(HttpStatusCode.Unauthorized)
    });
  }

  testConnection(northId: string, settings: NorthSettings, northType: OIBusNorthType): Observable<OIBusConnectionTestResult> {
    return this.http.post<OIBusConnectionTestResult>(`/api/north/${northId}/test/connection`, settings, {
      // the identity of a server not trusted is shown, for the user to review and trust it
      params: this.formServerTrust.withTrustedFingerprint('north', { northType, withServerIdentity: 'true' }),
      // the test connection modal already displays the error inline, so skip the global error notification
      context: new HttpContext().set(SHOULD_IGNORE_ERROR_PREDICATE, error => error.status !== HttpStatusCode.Unauthorized)
    });
  }

  /**
   * The identity the server of the North presents with these settings, and how it compares with the identity trusted
   * (by the connector, or in its form), without connecting further: null when the connector does not check it
   */
  retrieveServerIdentity(northId: string, settings: NorthSettings, northType: OIBusNorthType): Observable<PresentedServerIdentity | null> {
    return this.http.post<PresentedServerIdentity | null>(`/api/north/${northId}/test/server-identity`, settings, {
      params: this.formServerTrust.withTrustedFingerprint('north', { northType }),
      // a server which cannot be reached does not prevent saving or starting the connector
      context: new HttpContext().set(SHOULD_IGNORE_ERROR_PREDICATE, error => error.status !== HttpStatusCode.Unauthorized)
    });
  }

  /**
   * The trust of the North in the identity of its server, with the identity it refused. Polled in the background, so only
   * an expired session is notified
   */
  getServerTrust(northId: string): Observable<ServerTrustStateDTO> {
    return this.http.get<ServerTrustStateDTO>(`/api/north/${northId}/server-trust`, {
      context: ignoreErrorUnlessStatusIs(HttpStatusCode.Unauthorized)
    });
  }

  /** Trust the identity the server of the North presents (with this fingerprint), and restart the connector */
  trustServerIdentity(northId: string, fingerprint: string): Observable<void> {
    return this.http
      .post<void>(`/api/north/${northId}/server-trust`, { fingerprint })
      .pipe(tap(() => this.certificateService.refreshList()));
  }

  /** The certificate of an identity trusted in the form is added to the store with the connector */
  private refreshCertificatesWhenTrusting(serverTrust: ServerTrustCommandDTO | undefined) {
    if (serverTrust?.identity) {
      this.certificateService.refreshList();
    }
  }

  /**
   * Add or edit a North connector transformer
   */
  addOrEditTransformer(northId: string, transformerWithOptions: TransformerDTOWithOptions): Observable<TransformerDTOWithOptions> {
    return this.http.post<TransformerDTOWithOptions>(`/api/north/${northId}/transformers`, transformerWithOptions);
  }

  /**
   * Remove the selected North connector transformer
   */
  removeTransformer(northId: string, northTransformerId: string): Observable<void> {
    return this.http.delete<void>(`/api/north/${northId}/transformers/${northTransformerId}`);
  }

  /**
   * List files from north cache by search params
   */
  searchCacheContent(northId: string, searchParams: CacheSearchParam): Observable<CacheSearchResult> {
    const params: Record<string, number | string | Array<string>> = {
      maxNumberOfFilesReturned: searchParams.maxNumberOfFilesReturned
    };
    if (searchParams.start) {
      params['start'] = searchParams.start;
    }
    if (searchParams.end) {
      params['end'] = searchParams.end;
    }
    if (searchParams.nameContains) {
      params['nameContains'] = searchParams.nameContains;
    }
    return this.http.get<CacheSearchResult>(`/api/north/${northId}/cache/search`, { params });
  }

  /**
   * Retrieve file content from north cache
   */
  getCacheFileContent(northId: string, folder: DataFolderType, filename: string): Observable<FileCacheContent> {
    return this.http.get<FileCacheContent>(`/api/north/${northId}/cache/content/${filename}`, {
      params: {
        folder
      }
    });
  }

  /**
   * Update north cache content by moving or removing files from cache, archive and error folders
   */
  updateCacheContent(northId: string, updateCommand: CacheContentUpdateCommand): Observable<void> {
    return this.http.post<void>(`/api/north/${northId}/cache/update`, updateCommand);
  }
}
