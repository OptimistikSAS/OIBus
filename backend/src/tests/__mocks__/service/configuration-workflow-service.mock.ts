import { mock } from 'node:test';
import { ConfigurationWorkflowEntity } from '../../../model/configuration-workflow.model';
import { ConfigurationWorkflowCommandDTO } from '../../../../shared/model/configuration-workflow.model';

/**
 * Create a mock object for Configuration Workflow Service
 */
export default class ConfigurationWorkflowServiceMock {
  findById = mock.fn((_southId: string, _workflowId: string): ConfigurationWorkflowEntity => ({}) as ConfigurationWorkflowEntity);
  findBySouthId = mock.fn((_southId: string): Array<ConfigurationWorkflowEntity> => []);
  create = mock.fn(
    (_southId: string, _command: ConfigurationWorkflowCommandDTO, _user: string): ConfigurationWorkflowEntity =>
      ({}) as ConfigurationWorkflowEntity
  );
  update = mock.fn(
    (_southId: string, _workflowId: string, _command: ConfigurationWorkflowCommandDTO, _user: string): ConfigurationWorkflowEntity =>
      ({}) as ConfigurationWorkflowEntity
  );
  delete = mock.fn((_southId: string, _workflowId: string, _user: string): void => undefined);
}
