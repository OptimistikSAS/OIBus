import { inject, Service } from '@angular/core';

import { map, Observable, of } from 'rxjs';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';

import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { NotificationService } from '../../shared/notification.service';
import { TEMP_ID_PREFIX, toConfigurationWorkflowCommand } from './workflow-command';

/**
 * Creates Configuration Workflows the same way wherever they come from - the Manage workflows modal, or the
 * Explore wizard - in either of the two modes of the page (saved through the API, or kept in memory).
 */
@Service()
export class WorkflowCreationService {
  private readonly configurationWorkflowService = inject(ConfigurationWorkflowService);
  private readonly notificationService = inject(NotificationService);

  /**
   * Saves a new workflow: through the API in direct mode, or with a temporary id in memory mode. Emits the
   * saved workflow, as the command shape both modes work on.
   */
  save(southId: string, command: ConfigurationWorkflowCommandDTO, directSave: boolean): Observable<ConfigurationWorkflowCommandDTO> {
    if (!directSave) {
      return of({ ...command, id: `${TEMP_ID_PREFIX}${Date.now()}` });
    }
    return this.configurationWorkflowService.create(southId, command).pipe(
      map(created => {
        this.notificationService.success('south.workflows.created');
        return toConfigurationWorkflowCommand(created);
      })
    );
  }
}
