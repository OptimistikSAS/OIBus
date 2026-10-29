import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';

import { buildWorkflow, buildWorkflowCommand } from '../../../test/builders';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { NotificationService } from '../../shared/notification.service';
import { WorkflowCreationService } from './workflow-creation.service';

describe('WorkflowCreationService', () => {
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let notificationService: MockObject<NotificationService>;
  let service: WorkflowCreationService;

  const command = buildWorkflowCommand(null, 'Reactor', { discoveryScope: { nodeIds: ['ns=1;s=Reactor'] } });

  beforeEach(() => {
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    service = TestBed.inject(WorkflowCreationService);
  });

  test('should save a new workflow through the API in direct mode', () => {
    configurationWorkflowService.create.mockReturnValue(
      of(buildWorkflow('workflow2', 'Reactor', { discoveryScope: { nodeIds: ['ns=1;s=Reactor'] } }))
    );
    const saved: Array<ConfigurationWorkflowCommandDTO> = [];

    service.save('southId1', command, true).subscribe(workflow => saved.push(workflow));

    expect(configurationWorkflowService.create).toHaveBeenCalledWith('southId1', command);
    expect(notificationService.success).toHaveBeenCalledWith('south.workflows.created');
    expect(saved).toEqual([{ ...command, id: 'workflow2' }]);
  });

  test('should give a new workflow a temporary id in memory mode', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const saved: Array<ConfigurationWorkflowCommandDTO> = [];

    service.save('create', command, false).subscribe(workflow => saved.push(workflow));

    expect(configurationWorkflowService.create).not.toHaveBeenCalled();
    expect(saved).toEqual([{ ...command, id: 'temp_42' }]);
  });
});
