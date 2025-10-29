import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import NorthConnectorController from '../controllers/north-connector.controller';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../shared/model/north-connector.model';
import { NorthSettings } from 'shared/model/north-settings.model';
import { TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import { ReadStream } from 'node:fs';
import { CacheMetadata } from '../../../shared/model/engine.model';

const joiValidator = new JoiValidator();
const northConnectorController = new NorthConnectorController(joiValidator);

const router = new Router();

router.get('/api/north-types', (ctx: KoaContext<void, Array<NorthType>>) => northConnectorController.getNorthConnectorTypes(ctx));
router.get('/api/north-types/:id', (ctx: KoaContext<void, NorthConnectorManifest>) =>
  northConnectorController.getNorthConnectorManifest(ctx)
);
router.get('/api/north', (ctx: KoaContext<void, Array<NorthConnectorLightDTO>>) => northConnectorController.findAll(ctx));
router.put('/api/north/:id/test-connection', (ctx: KoaContext<NorthSettings, void>) => northConnectorController.testNorthConnection(ctx));
router.get('/api/north/:id', (ctx: KoaContext<void, NorthConnectorDTO<NorthSettings>>) => northConnectorController.findById(ctx));
router.post('/api/north', (ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, NorthConnectorDTO<NorthSettings>>) =>
  northConnectorController.create(ctx)
);
router.put('/api/north/:id', (ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>) => northConnectorController.updateNorth(ctx));
router.delete('/api/north/:id', (ctx: KoaContext<void, void>) => northConnectorController.delete(ctx));
router.put('/api/north/:id/start', (ctx: KoaContext<void, void>) => northConnectorController.start(ctx));
router.put('/api/north/:id/stop', (ctx: KoaContext<void, void>) => northConnectorController.stop(ctx));
router.put('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<void, void>) => northConnectorController.addSubscription(ctx));
router.delete('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeSubscription(ctx)
);
router.put('/api/north/:northId/transformers', (ctx: KoaContext<TransformerDTOWithOptions, void>) =>
  northConnectorController.addOrEditTransformer(ctx)
);
router.delete('/api/north/:northId/transformers/:transformerId', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeTransformer(ctx)
);
router.get('/api/north/:northId/cache/content', (ctx: KoaContext<void, Array<{ metadataFilename: string; metadata: CacheMetadata }>>) =>
  northConnectorController.searchCacheContent(ctx)
);
router.get('/api/north/:northId/cache/content/:filename', (ctx: KoaContext<void, ReadStream>) =>
  northConnectorController.getCacheContentFileStream(ctx)
);
router.delete('/api/north/:northId/cache/content/remove', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.removeCacheContent(ctx)
);
router.delete('/api/north/:northId/cache/content/remove-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeAllCacheContent(ctx)
);
router.post('/api/north/:northId/cache/content/move', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.moveCacheContent(ctx)
);
router.post('/api/north/:northId/cache/content/move-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.moveAllCacheContent(ctx)
);
router.put('/api/north/:northId/cache/reset-metrics', (ctx: KoaContext<void, void>) => northConnectorController.resetMetrics(ctx));

export default router;
