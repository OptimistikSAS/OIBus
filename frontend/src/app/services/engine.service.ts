import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';

import { Observable, shareReplay, tap } from 'rxjs';

import {
  EngineGeneralCommandDTO,
  EngineLoggerCommandDTO,
  EngineMemoryDumpDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  EngineSettingsUpdateResultDTO,
  EngineWebServerCommandDTO,
  HomeMetrics,
  OIBusInfo,
  RegistrationSettingsCommandDTO,
  RegistrationSettingsDTO
} from '@oibus/shared/api/engine.model';
import { ServerTrustStateDTO } from '@oibus/shared/api/server-identity.model';
import { EngineMetrics, OIBusConnectionTestResult } from '@oibus/shared/domain/engine.model';

import { ignoreErrorUnlessStatusIs } from '../shared/error-interceptor.service';
import { CertificateService } from './certificate.service';

/**
 * Service used to interact with the backend for CRUD operations on the engine settings
 */
@Service()
export class EngineService {
  private readonly http = inject(HttpClient);
  private readonly certificateService = inject(CertificateService);

  /**
   * Get the engine settings
   */
  getEngineSettings(): Observable<EngineSettingsDTO> {
    return this.http.get<EngineSettingsDTO>(`/api/engine`);
  }

  /**
   * Update the selected external source
   * @param command - the new values of the engine settings
   * @returns Information about whether a redirect is needed due to port change
   */
  updateEngineSettings(command: EngineSettingsCommandDTO): Observable<EngineSettingsUpdateResultDTO> {
    return this.http.put<EngineSettingsUpdateResultDTO>(`/api/engine`, command);
  }

  updateEngineGeneral(command: EngineGeneralCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/engine/general`, command);
  }

  updateEngineWebServer(command: EngineWebServerCommandDTO): Observable<EngineSettingsUpdateResultDTO> {
    return this.http.put<EngineSettingsUpdateResultDTO>(`/api/engine/web-server`, command);
  }

  updateEngineProxy(command: EngineProxyCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/engine/proxy`, command);
  }

  updateEngineLogger(command: EngineLoggerCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/engine/logger`, command);
  }

  /**
   * Reset the Engine metrics
   */
  resetEngineMetrics(): Observable<void> {
    return this.http.post<void>(`/api/engine/metrics/reset`, null);
  }

  /**
   * Get the current Engine metrics. Polled in the background, so only an expired session is notified
   */
  getEngineMetrics(): Observable<EngineMetrics> {
    return this.http.get<EngineMetrics>(`/api/engine/metrics`, { context: ignoreErrorUnlessStatusIs(HttpStatusCode.Unauthorized) });
  }

  /**
   * Get the metrics displayed on the home page. Polled in the background, so only an expired session is notified
   */
  getHomeMetrics(): Observable<HomeMetrics> {
    return this.http.get<HomeMetrics>(`/api/engine/home-metrics`, { context: ignoreErrorUnlessStatusIs(HttpStatusCode.Unauthorized) });
  }

  restart(): Observable<void> {
    return this.http.post<void>('/api/engine/restart', null);
  }

  dumpMemory(): Observable<EngineMemoryDumpDTO> {
    return this.http.post<EngineMemoryDumpDTO>('/api/engine/memory-dump', null);
  }

  readonly info$: Observable<OIBusInfo> = this.http.get<OIBusInfo>('/api/engine/info').pipe(shareReplay(1));

  getInfo(): Observable<OIBusInfo> {
    return this.info$;
  }

  fetchInfo(): Observable<OIBusInfo> {
    return this.http.get<OIBusInfo>('/api/engine/info');
  }

  getRegistrationSettings(): Observable<RegistrationSettingsDTO> {
    return this.http.get<RegistrationSettingsDTO>(`/api/oianalytics/registration`);
  }

  /**
   * Register OIAnalytics (generate 6 characters code)
   */
  register(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/register`, command).pipe(tap(() => this.refreshCertificatesWhenTrusting(command)));
  }

  /**
   * Edit registration permissions and intervals
   */
  editRegistrationSettings(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/oianalytics/registration`, command).pipe(tap(() => this.refreshCertificatesWhenTrusting(command)));
  }

  /**
   * Test connection to OIAnalytics with the provided settings: the result carries the identity OIAnalytics presents when its
   * certificate does not validate (the connection is then not tested further)
   */
  testOIAnalyticsConnection(command: RegistrationSettingsCommandDTO): Observable<OIBusConnectionTestResult> {
    return this.http.post<OIBusConnectionTestResult>(`/api/oianalytics/registration/test-connection`, command, {
      params: { withServerIdentity: true }
    });
  }

  /** The trust of the registration in the identity of OIAnalytics, with the identity it refused at its last request */
  getRegistrationServerTrust(): Observable<ServerTrustStateDTO> {
    return this.http.get<ServerTrustStateDTO>(`/api/oianalytics/registration/server-trust`, {
      context: ignoreErrorUnlessStatusIs(HttpStatusCode.Unauthorized)
    });
  }

  /** Trusts the identity OIAnalytics presents, when it has this fingerprint */
  trustRegistrationServerIdentity(fingerprint: string): Observable<void> {
    return this.http
      .post<void>(`/api/oianalytics/registration/server-trust`, { fingerprint })
      .pipe(tap(() => this.certificateService.refreshList()));
  }

  /** The certificate of the identity of OIAnalytics trusted in the form is added to the store with the registration */
  private refreshCertificatesWhenTrusting(command: RegistrationSettingsCommandDTO) {
    if (command.serverTrust?.identity) {
      this.certificateService.refreshList();
    }
  }

  unregister(): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/unregister`, null);
  }
}
