import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { Service, inject } from '@angular/core';
import { ignoreErrorUnlessStatusIs } from '../shared/error-interceptor.service';
import {
  EngineLoggerCommandDTO,
  EngineMemoryDumpDTO,
  EngineMetrics,
  EngineNameCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  EngineSettingsUpdateResultDTO,
  EngineWebServerCommandDTO,
  HomeMetrics,
  OIBusInfo,
  RegistrationSettingsCommandDTO,
  RegistrationSettingsDTO
} from '@oibus/shared/engine.model';

/**
 * Service used to interact with the backend for CRUD operations on the engine settings
 */
@Service()
export class EngineService {
  private http = inject(HttpClient);

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

  updateEngineName(command: EngineNameCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/engine/name`, command);
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
    return this.http.post<void>(`/api/oianalytics/register`, command);
  }

  /**
   * Edit registration permissions and intervals
   */
  editRegistrationSettings(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/oianalytics/registration`, command);
  }

  /**
   * Test connection to OIAnalytics with the provided settings
   */
  testOIAnalyticsConnection(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/registration/test-connection`, command);
  }

  unregister(): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/unregister`, null);
  }
}
