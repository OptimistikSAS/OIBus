import fs from 'node:fs/promises';
import path from 'node:path';

import { OIBusObjectAttribute } from '../../../shared/model/connector/form.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';
import {
  OIBUS_INTERACTIVE_SESSION_REQUEST_REQUIRED_PERMISSIONS,
  OIBusBrowseRequestContent,
  OIBusCloseExploreRequestContent,
  OIBusInteractiveSessionFileResult,
  OIBusInteractiveSessionRequestDTO,
  OIBusInteractiveSessionSouthContent,
  OIBusPreviewWorkflowRequestContent,
  OIBusStartExploreResult,
  OIBusTestSouthItemRequestContent,
  OIBusTrustServerIdentityRequestContent
} from '../../../shared/model/oia/interactive-session.model';

import type { ILogger } from '../../model/logger.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import type ConfigurationWorkflowRunService from '../configuration-workflow-run.service';
import { encryptionService } from '../encryption.service';
import type HistoryQueryService from '../history-query.service';
import type NorthService from '../north.service';
import type SouthService from '../south.service';
import { getErrorMessage, withTimeout } from '../utils';
import type OIAnalyticsClient from './oianalytics-client.service';
import type OIAnalyticsRegistrationService from './oianalytics-registration.service';
import { getPrivateCipherKeys } from './oianalytics-registration.service';

/** Interval between two polls of the requests of a session: a request waits at most this long before being executed. */
export const SESSION_POLL_INTERVAL_MS = 1000;
/** Like the test commands, a request opening a connection must not hang forever. */
export const SESSION_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
/** A session OIAnalytics cannot be reached for during this long is closed (OIAnalytics expires it meanwhile). */
export const SESSION_UNREACHABLE_TIMEOUT_MS = 10 * 60 * 1000;
/** Results longer than this (OIAnalytics accepts 1 000 000 characters inline) are uploaded as a file. */
export const MAX_INLINE_RESULT_LENGTH = 900_000;

interface InteractiveSession {
  id: string;
  /** The explores started by the requests of the session: only they can be browsed and closed through it. */
  exploreIds: Set<string>;
  pollTimeout: NodeJS.Timeout | null;
  lastReachedAt: number;
  closed: boolean;
}

/**
 * Executes the interactive sessions opened by OIAnalytics with `open-interactive-session` commands: each open session
 * polls its requests at a short interval, executes them concurrently (exploring a data source, testing a connection,
 * previewing a configuration workflow) and sends their results back. A session is closed when OIAnalytics answers it does
 * not exist anymore (closed by the user, or expired), when OIAnalytics cannot be reached for too long, when OIBus is not
 * registered anymore, or when OIBus stops. The explores of a session are closed with it.
 */
export default class OIAnalyticsSessionService {
  private readonly sessions = new Map<string, InteractiveSession>();

  constructor(
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private oIAnalyticsClient: OIAnalyticsClient,
    private southService: SouthService,
    private northService: NorthService,
    private historyQueryService: HistoryQueryService,
    private configurationWorkflowRunService: ConfigurationWorkflowRunService,
    private logger: ILogger,
    private tmpFolder: string
  ) {}

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Opens the given session, and starts polling its requests. Opening a session already open does nothing.
   */
  open(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      return;
    }
    const session: InteractiveSession = {
      id: sessionId,
      exploreIds: new Set(),
      pollTimeout: null,
      lastReachedAt: Date.now(),
      closed: false
    };
    this.sessions.set(sessionId, session);
    this.logger.info(`Interactive session ${sessionId} opened`);
    this.schedulePoll(session, 0);
  }

  getOpenSessionIds(): Array<string> {
    return [...this.sessions.keys()];
  }

  /**
   * Closes every session, telling OIAnalytics so when possible. Called when OIBus stops.
   */
  async stop(): Promise<void> {
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings();
    await Promise.all(
      [...this.sessions.values()].map(async session => {
        await this.closeLocally(session);
        if (registration?.status === 'REGISTERED') {
          try {
            await this.oIAnalyticsClient.closeSession(registration, session.id);
          } catch (error: unknown) {
            this.logger.debug(`Could not close interactive session ${session.id} on OIAnalytics: ${getErrorMessage(error)}`);
          }
        }
      })
    );
  }

  private schedulePoll(session: InteractiveSession, delay: number): void {
    if (session.closed) return;
    session.pollTimeout = setTimeout(() => this.poll(session), delay);
  }

  private async poll(session: InteractiveSession): Promise<void> {
    session.pollTimeout = null;
    if (session.closed) return;
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings();
    if (registration?.status !== 'REGISTERED') {
      this.logger.info(`OIBus is not registered anymore: interactive session ${session.id} closed`);
      await this.closeLocally(session);
      return;
    }
    if (!registration.commandPermissions.connectToDataSources) {
      this.logger.info(`OIAnalytics is not allowed to connect to the data sources anymore: interactive session ${session.id} closed`);
      await this.closeLocally(session);
      try {
        await this.oIAnalyticsClient.closeSession(registration, session.id);
      } catch (error: unknown) {
        this.logger.debug(`Could not close interactive session ${session.id} on OIAnalytics: ${getErrorMessage(error)}`);
      }
      return;
    }

    let requests: Array<OIBusInteractiveSessionRequestDTO>;
    try {
      requests = await this.oIAnalyticsClient.retrieveSessionRequests(registration, session.id);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message.startsWith('404 - ')) {
        this.logger.info(`Interactive session ${session.id} closed by OIAnalytics`);
        await this.closeLocally(session);
      } else if (Date.now() - session.lastReachedAt >= SESSION_UNREACHABLE_TIMEOUT_MS) {
        this.logger.warn(`OIAnalytics unreachable for too long: interactive session ${session.id} closed. Last error: ${message}`);
        await this.closeLocally(session);
      } else {
        this.logger.warn(`Error while retrieving the requests of interactive session ${session.id}: ${message}`);
        this.schedulePoll(session, registration.commandRetryInterval * 1000);
      }
      return;
    }

    session.lastReachedAt = Date.now();
    for (const request of requests) {
      // Not awaited: a long request (a connection test timing out) must not delay the others
      this.executeRequest(session, registration, request).catch((error: unknown) =>
        this.logger.error(`Error while executing request ${request.id} of interactive session ${session.id}: ${getErrorMessage(error)}`)
      );
    }
    this.schedulePoll(session, SESSION_POLL_INTERVAL_MS);
  }

  private async executeRequest(
    session: InteractiveSession,
    registration: OIAnalyticsRegistration,
    request: OIBusInteractiveSessionRequestDTO
  ): Promise<void> {
    this.logger.debug(`Executing request ${request.type} (${request.id}) of interactive session ${session.id}`);
    let status: 'COMPLETED' | 'ERRORED';
    let result: unknown;
    try {
      result = await withTimeout(this.handleRequest(session, registration, request), SESSION_REQUEST_TIMEOUT_MS, request.type);
      status = 'COMPLETED';
    } catch (error: unknown) {
      result = getErrorMessage(error);
      status = 'ERRORED';
    }
    await this.sendResult(session, registration, request, status, result ?? null);
  }

  private async sendResult(
    session: InteractiveSession,
    registration: OIAnalyticsRegistration,
    request: OIBusInteractiveSessionRequestDTO,
    status: 'COMPLETED' | 'ERRORED',
    result: unknown
  ): Promise<void> {
    const serializedResult = JSON.stringify(result);
    if (serializedResult.length <= MAX_INLINE_RESULT_LENGTH) {
      await this.oIAnalyticsClient.completeSessionRequest(registration, session.id, request.id, { status, result });
      return;
    }

    const fileName = `${request.type.toLowerCase().replaceAll('_', '-')}-result.json`;
    const filePath = path.resolve(this.tmpFolder, `session-request-${request.id}.json`);
    try {
      await fs.writeFile(filePath, serializedResult);
      await this.oIAnalyticsClient.uploadSessionRequestFile(registration, session.id, request.id, filePath, fileName);
    } finally {
      await fs.rm(filePath, { force: true });
    }
    const fileResult: OIBusInteractiveSessionFileResult = { fileName, size: Buffer.byteLength(serializedResult) };
    await this.oIAnalyticsClient.completeSessionRequest(registration, session.id, request.id, { status, result: fileResult });
  }

  private async handleRequest(
    session: InteractiveSession,
    registration: OIAnalyticsRegistration,
    request: OIBusInteractiveSessionRequestDTO
  ): Promise<unknown> {
    const missingPermissions = (OIBUS_INTERACTIVE_SESSION_REQUEST_REQUIRED_PERMISSIONS[request.type] ?? []).filter(
      permission => !registration.commandPermissions[permission]
    );
    if (missingPermissions.length > 0) {
      throw new Error(`OIAnalytics is not allowed to request ${request.type}: it requires the permission ${missingPermissions.join(', ')}`);
    }
    switch (request.type) {
      case 'START_EXPLORE': {
        const content = this.decryptSouthContent(request.content as OIBusInteractiveSessionSouthContent, registration);
        const explore = await this.southService.startExplore(
          content.southId,
          content.southType,
          content.settings,
          content.trustedFingerprint ?? null
        );
        if (session.closed) {
          // The session was closed while connecting: its explores have already been closed
          await this.southService.closeExplore(explore.sessionId);
          throw new Error(`Interactive session ${session.id} closed`);
        }
        session.exploreIds.add(explore.sessionId);
        const result: OIBusStartExploreResult = { exploreId: explore.sessionId, entries: explore.entries };
        return result;
      }
      case 'BROWSE': {
        const content = request.content as OIBusBrowseRequestContent;
        this.checkExplore(session, content.exploreId);
        return await this.southService.browseExplore(content.exploreId, content.parentId);
      }
      case 'CLOSE_EXPLORE': {
        const content = request.content as OIBusCloseExploreRequestContent;
        this.checkExplore(session, content.exploreId);
        session.exploreIds.delete(content.exploreId);
        await this.southService.closeExplore(content.exploreId);
        return null;
      }
      case 'TEST_SOUTH_CONNECTION': {
        const content = this.decryptSouthContent(request.content as OIBusInteractiveSessionSouthContent, registration);
        // OIAnalytics shows the identity of a server not trusted, for the user to review and trust it
        return await this.southService.testSouth(
          content.southId,
          content.southType,
          content.settings,
          content.trustedFingerprint ?? null,
          null,
          true
        );
      }
      case 'TEST_SOUTH_ITEM': {
        const content = this.decryptSouthContent(
          request.content as OIBusTestSouthItemRequestContent,
          registration
        ) as OIBusTestSouthItemRequestContent & { southId: string };
        const itemSettings = this.decryptItemSettings(content, registration);
        return await this.southService.testItem(
          content.southId,
          content.southType,
          content.itemName,
          content.settings,
          itemSettings,
          content.testingSettings,
          undefined,
          content.trustedFingerprint ?? null
        );
      }
      case 'PREVIEW_WORKFLOW': {
        const content = this.decryptSouthContent(
          request.content as OIBusPreviewWorkflowRequestContent,
          registration
        ) as OIBusPreviewWorkflowRequestContent & { southId: string };
        return await this.configurationWorkflowRunService.previewCommand(
          content.southId,
          content.southType,
          content.settings,
          content.workflowId,
          content.workflow,
          content.trustedFingerprint ?? null
        );
      }
      case 'TRUST_SERVER_IDENTITY': {
        const content = request.content as OIBusTrustServerIdentityRequestContent;
        switch (content.target) {
          case 'south':
            await this.southService.trustServerIdentity(content.id, content.fingerprint, 'oianalytics');
            break;
          case 'north':
            await this.northService.trustServerIdentity(content.id, content.fingerprint, 'oianalytics');
            break;
          case 'history-query':
            if (content.side !== 'south' && content.side !== 'north') {
              throw new Error(`The side of history query "${content.id}" to trust the server of is missing`);
            }
            await this.historyQueryService.trustServerIdentity(content.id, content.side, content.fingerprint, 'oianalytics');
            break;
          default:
            throw new Error(`Cannot trust the identity of the server of a "${content.target}"`);
        }
        return null;
      }
      default:
        throw new Error(`Interactive session request type "${request.type}" not supported`);
    }
  }

  private checkExplore(session: InteractiveSession, exploreId: string): void {
    if (!session.exploreIds.has(exploreId)) {
      throw new Error(`Explore "${exploreId}" not found in interactive session ${session.id}`);
    }
  }

  /**
   * Decrypts the secrets of the settings sent by OIAnalytics (encrypted with the public key of OIBus), and resolves the
   * connector ID the South service expects for a connector not saved yet.
   */
  private decryptSouthContent<T extends OIBusInteractiveSessionSouthContent>(
    content: T,
    registration: OIAnalyticsRegistration
  ): Omit<T, 'southId'> & { southId: string; settings: SouthSettings } {
    const manifest = this.southService.getManifest(content.southType);
    const settings = encryptionService.decryptSecretsWithPrivateKey(
      content.settings,
      manifest.settings,
      getPrivateCipherKeys(registration)
    );
    return { ...content, southId: content.southId ?? 'create', settings };
  }

  private decryptItemSettings(content: OIBusTestSouthItemRequestContent, registration: OIAnalyticsRegistration): SouthItemSettings {
    const manifest = this.southService.getManifest(content.southType);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    return encryptionService.decryptSecretsWithPrivateKey(content.itemSettings, itemSettingsManifest, getPrivateCipherKeys(registration));
  }

  private async closeLocally(session: InteractiveSession): Promise<void> {
    session.closed = true;
    if (session.pollTimeout) {
      clearTimeout(session.pollTimeout);
      session.pollTimeout = null;
    }
    this.sessions.delete(session.id);
    for (const exploreId of session.exploreIds) {
      try {
        await this.southService.closeExplore(exploreId);
      } catch (error: unknown) {
        this.logger.debug(`Could not close explore ${exploreId} of interactive session ${session.id}: ${getErrorMessage(error)}`);
      }
    }
    session.exploreIds.clear();
  }
}
