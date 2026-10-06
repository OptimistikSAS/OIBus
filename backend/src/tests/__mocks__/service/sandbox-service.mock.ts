import { mock } from 'node:test';

import { CacheMetadata } from '../../../../shared/model/api/engine.model';

import { CacheMetadataSource } from '../../../model/engine.model';
import type { ILogger } from '../../../model/logger.model';
import { CustomTransformer } from '../../../model/transformer.model';

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
