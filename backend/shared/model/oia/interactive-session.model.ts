import { ConfigurationWorkflowCommandDTO } from '../api/configuration-workflow.model';
import { Instant } from '../common/types';
import { OIBusSouthType } from '../connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '../connector/south-settings.model';
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
  'PREVIEW_WORKFLOW'
] as const;
export type OIBusInteractiveSessionRequestType = (typeof OIBUS_INTERACTIVE_SESSION_REQUEST_TYPES)[number];

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
 * Content of a `TEST_SOUTH_CONNECTION` request. Its result is an `OIBusConnectionTestResult`.
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
