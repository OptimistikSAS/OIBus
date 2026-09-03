import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { createAuditServiceMock } from '../../../utils/test-utils';
import { ConfigurationWorkflowCommand, ConfigurationWorkflowEntity } from '../../../../model/configuration-workflow.model';
import ConfigurationWorkflowRepository from '../../../../repository/config/configuration-workflow.repository';

/**
 * Create a mock object for Configuration Workflow repository
 */
export default class ConfigurationWorkflowRepositoryMock extends ConfigurationWorkflowRepository {
  constructor() {
    super({} as Database, createAuditServiceMock());
  }
  override findById = mock.fn((_id: string): ConfigurationWorkflowEntity | null => null);
  override findBySouthId = mock.fn((_southId: string): Array<ConfigurationWorkflowEntity> => []);
  override findByNameAndSouthId = mock.fn((_name: string, _southId: string): ConfigurationWorkflowEntity | null => null);
  override create = mock.fn(
    (_command: ConfigurationWorkflowCommand, _createdBy: string): ConfigurationWorkflowEntity => ({}) as ConfigurationWorkflowEntity
  );
  override update = mock.fn((_id: string, _command: Omit<ConfigurationWorkflowCommand, 'southId'>, _updatedBy: string): void => undefined);
  override delete = mock.fn((_id: string, _deletedBy: string): void => undefined);
}
