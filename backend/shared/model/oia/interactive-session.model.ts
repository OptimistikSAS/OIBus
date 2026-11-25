import { ConfigurationWorkflowCommandDTO } from '../api/configuration-workflow.model';
import { Instant } from '../common/types';
import { OIBusSouthType } from '../connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '../connector/south-settings.model';
import { CommandPermission } from '../domain/engine.model';
import { SouthConnectorExploreEntry, SouthConnectorItemTestingSettings } from '../domain/south-connector.model';

/**
 * The operations OIAnalytics can request through an interactive session, opened by an `open-interactive-session`
 * command. OIBus polls the requests of an open session at a short interval, executes them and sends their results back.
 */
export const OIBUS_INTERACTIVE_SESSION_REQUEST_TYPES = [
  'START_EXPLORE',
  'BROWSE',
  'CLOSE_EXPLORE',
  'TEST_SOUTH_CONNECTION',
  'TEST_SOUTH_ITEM',
  'PREVIEW_WORKFLOW',
  'GET_SERVER_TRUST',
  'TRUST_SERVER_IDENTITY'
] as const;
export type OIBusInteractiveSessionRequestType = (typeof OIBUS_INTERACTIVE_SESSION_REQUEST_TYPES)[number];

/**
 * The permissions a request of an interactive session requires, all of them, on top of `connectToDataSources` which opening
 * the session requires. Trusting the identity of a server changes the configuration of a connector: it decides which server
 * receives its credentials and its data, as changing its URL does.
 */
export const OIBUS_INTERACTIVE_SESSION_REQUEST_REQUIRED_PERMISSIONS: Readonly<
  Record<OIBusInteractiveSessionRequestType, ReadonlyArray<CommandPermission>>
> = {
  START_EXPLORE: ['connectToDataSources'],
  BROWSE: ['connectToDataSources'],
  CLOSE_EXPLORE: ['connectToDataSources'],
  TEST_SOUTH_CONNECTION: ['connectToDataSources'],
  TEST_SOUTH_ITEM: ['connectToDataSources'],
  PREVIEW_WORKFLOW: ['connectToDataSources'],
  GET_SERVER_TRUST: ['connectToDataSources'],
  TRUST_SERVER_IDENTITY: ['connectToDataSources', 'configureDataFlow']
};

/**
 * A request of an interactive session, as retrieved from OIAnalytics. Its content depends on its type (see the
 * `*RequestContent` interfaces below).
 */
export interface OIBusInteractiveSessionRequestDTO {
  id: string;
  type: OIBusInteractiveSessionRequestType;
  content: unknown;
  creationDate: Instant;
}

/**
 * The South connector a request is executed with: a saved one, or one being edited in OIAnalytics. The secrets of its
 * settings are encrypted with the public key of the OIBus, like in the commands; an empty secret of a saved connector
 * keeps its stored value.
 */
export interface OIBusInteractiveSessionSouthContent {
  /**
   * The ID of the saved South connector, null for a connector not saved yet.
   */
  southId: string | null;
  southType: OIBusSouthType;
  settings: SouthSettings;
  /**
   * The SHA-256 fingerprint of the identity of the server trusted in the form of the connector in OIAnalytics, not saved
   * yet: the request trusts it when the server presents it (as the identity trusted by the saved connector otherwise).
   */
  trustedFingerprint?: string | null;
}

/**
 * Content of a `START_EXPLORE` request: connects the South connector to explore its data source. Its result is a
 * {@link OIBusStartExploreResult}.
 */
export type OIBusStartExploreRequestContent = OIBusInteractiveSessionSouthContent;

/**
 * Result of a `START_EXPLORE` request.
 */
export interface OIBusStartExploreResult {
  /**
   * The ID of the explore, used by the `BROWSE` and `CLOSE_EXPLORE` requests of the same session.
   */
  exploreId: string;
  /**
   * The root entries of the data source.
   */
  entries: Array<SouthConnectorExploreEntry>;
}

/**
 * Content of a `BROWSE` request: lists the children of an entry. Its result is a {@link OIBusBrowseResult}.
 */
export interface OIBusBrowseRequestContent {
  exploreId: string;
  /**
   * The entry to expand, null for the root entries.
   */
  parentId: string | null;
}

/**
 * Result of a `BROWSE` request.
 */
export interface OIBusBrowseResult {
  entries: Array<SouthConnectorExploreEntry>;
}

/**
 * Content of a `CLOSE_EXPLORE` request: disconnects the South connector of an explore. Its result is null.
 */
export interface OIBusCloseExploreRequestContent {
  exploreId: string;
}

/**
 * Content of a `TEST_SOUTH_CONNECTION` request. Its result is an `OIBusConnectionTestResult`, carrying the identity the
 * server presents for the connectors checking it (`serverIdentity`): when it is not trusted, the connection is not tested
 * further (no credential is sent), for the user to review the identity and trust it (`TRUST_SERVER_IDENTITY`, or with the
 * connector saved by a command).
 */
export type OIBusTestSouthConnectionRequestContent = OIBusInteractiveSessionSouthContent;

/**
 * Content of a `TEST_SOUTH_ITEM` request. Its result is a `SouthConnectorItemTestResult`.
 */
export interface OIBusTestSouthItemRequestContent extends OIBusInteractiveSessionSouthContent {
  itemName: string;
  /**
   * The settings of the item, its secrets encrypted like the ones of the connector.
   */
  itemSettings: SouthItemSettings;
  testingSettings: SouthConnectorItemTestingSettings;
}

/**
 * Content of a `PREVIEW_WORKFLOW` request: what the next run of a configuration workflow, as edited, would discover,
 * without writing anything. Its result is a `WorkflowPreviewResultDTO`.
 */
export interface OIBusPreviewWorkflowRequestContent extends OIBusInteractiveSessionSouthContent {
  /**
   * The ID of the saved workflow, whose previous run classifies the discovered records; null for a workflow not saved
   * yet.
   */
  workflowId: string | null;
  workflow: ConfigurationWorkflowCommandDTO;
}

/**
 * The result of a request, sent by OIBus once executed.
 */
export interface OIBusInteractiveSessionRequestCompletionDTO {
  status: 'COMPLETED' | 'ERRORED';
  /**
   * The result of the operation, or the message of the error that prevented it. A result too large to be sent inline is
   * uploaded as a file first, and this one is then a {@link OIBusInteractiveSessionFileResult}.
   */
  result: unknown;
}

/**
 * The result sent inline when the result of a request has been uploaded as a file.
 */
export interface OIBusInteractiveSessionFileResult {
  fileName: string;
  /**
   * The size of the file, in bytes.
   */
  size: number;
}

/**
 * The saved connector, or side of a saved history query, whose trust in the identity of its server is requested.
 */
export interface OIBusServerTrustTarget {
  /**
   * A South connector, a North connector, or a history query (`side` telling which of its connectors).
   */
  target: 'south' | 'north' | 'history-query';
  /**
   * The ID of the connector or of the history query.
   */
  id: string;
  /**
   * For a history query, the side whose server is concerned.
   */
  side?: 'south' | 'north';
}

/**
 * Content of a `GET_SERVER_TRUST` request: the identity a saved connector, or a side of a saved history query, trusts for
 * its server, and the identity it refused at its last connection, waiting to be reviewed. Its result is a `ServerTrustState`
 * (`trustedBy` as in the configuration sent to OIAnalytics).
 */
export type OIBusGetServerTrustRequestContent = OIBusServerTrustTarget;

/**
 * Content of a `TRUST_SERVER_IDENTITY` request: trusts the identity the server of a saved connector, or of a side of a saved
 * history query, presents, when its fingerprint is the one the user reviewed (the server is asked for it again, so that
 * only its own identity is trusted). The connector, or the history query when it is running, restarts with it. Requires the
 * `configureDataFlow` permission. Its result is null.
 */
export interface OIBusTrustServerIdentityRequestContent extends OIBusServerTrustTarget {
  /**
   * The SHA-256 fingerprint of the identity to trust, as the connection test or `GET_SERVER_TRUST` showed it.
   * @example "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s"
   */
  fingerprint: string;
}
