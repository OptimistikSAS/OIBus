import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';

/** Prefix of the client-side id given to a workflow created in memory (not persisted yet) - the backend
 *  treats such an id as "create" when the south connector is saved, same convention as in-memory groups. */
export const TEMP_ID_PREFIX = 'temp_';

/** A persisted workflow as the command the edit modal works on (and edit-south keeps in memory). */
export function toConfigurationWorkflowCommand(workflow: ConfigurationWorkflowDTO): ConfigurationWorkflowCommandDTO {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    discoveryScope: workflow.discoveryScope,
    identityKeyFields: workflow.identityKeyFields,
    eligibilityFilter: workflow.eligibilityFilter,
    itemFieldMapping: workflow.itemFieldMapping,
    pushToOIAnalytics: workflow.pushToOIAnalytics,
    scanModeId: workflow.scanMode?.id ?? null,
    enabled: workflow.enabled
  };
}
