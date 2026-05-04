import { mock } from 'node:test';
import { CacheMetadata, CacheMetadataSource } from '../../../../shared/model/engine.model';
import { CustomTransformer } from '../../../model/transformer.model';
import type { ILogger } from '../../../model/logger.model';

/**
 * Create a mock object for Sandbox Service
 */
export default class SandboxServiceMock {
  execute = mock.fn(
    async (
      _stringContent: string,
      _source: CacheMetadataSource,
      _filename: string,
      _transformer: CustomTransformer,
      _options: object,
      _logger: ILogger
    ): Promise<{ metadata: CacheMetadata; output: string }> => ({ metadata: {} as CacheMetadata, output: '' })
  );
}
