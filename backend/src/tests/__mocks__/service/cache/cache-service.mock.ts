import type { CacheSizeEvents } from '../../../../model/cache.service.model';
import type CacheService from '../../../../service/cache/cache.service';
import TypedEventEmitter from '../../../../service/typed-event-emitter';
import { createMock, type Mocked } from '../../../utils/test-utils';

/**
 * A CacheService mock describing an empty cache, which is what most north connector specs need
 */
export function createCacheServiceMock(): Mocked<CacheService> {
  return createMock<CacheService>({
    getCacheContentToSend: async () => null,
    getNumberOfElementsInQueue: () => 0,
    getNumberOfRawFilesInQueue: () => 0,
    cacheIsEmpty: () => true,
    cacheIsFull: () => false,
    getCacheSize: () => 0,
    getCacheContentSizes: () => ({ cache: 0, error: 0, archive: 0 }),
    searchCacheContent: async () => ({ searchDate: '', error: [], archive: [], cache: [] }),
    errorFolder: 'error',
    archiveFolder: 'archive',
    cacheFolder: 'cache',
    cacheSizeEventEmitter: new TypedEventEmitter<CacheSizeEvents>()
  });
}
