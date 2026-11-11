import { OIBusRecord } from '../common/content.model';
import { Instant } from '../common/types';

/**
 * A record discovered by a synchronisation run, as pushed to OIAnalytics.
 */
export interface OIBusSyncMetadataRecordCommandDTO {
  /**
   * Identifies the record across runs: computed by OIBus from the identity key fields of the synchronisation, for
   * OIAnalytics to compare a run with the previous ones.
   */
  key: string;
  /** The fields of the record selected to be pushed. The identity key fields are always among them. */
  fields: OIBusRecord;
}

/**
 * What a synchronisation run pushing to OIAnalytics discovered: every eligible record of this run, the whole of them at
 * each run. A record of a previous run that is absent from this one is no longer discovered.
 */
export interface OIBusSyncMetadataCommandDTO {
  /** The ID of the synchronisation in OIBus. */
  syncId: string;
  syncName: string;
  southId: string;
  southName: string;
  southType: string;
  /** The ID of the run in OIBus. */
  runId: string;
  /** When the run discovered the records. */
  runAt: Instant;
  identityKeyFields: Array<string>;
  records: Array<OIBusSyncMetadataRecordCommandDTO>;
}
