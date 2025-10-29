import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import { SouthConnectorItemTestingSettings } from 'shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from 'shared/model/south-settings.model';
import { Page } from '../../../shared/model/types';
import multer from '@koa/multer';
import HistoryQueryController from '../controllers/history-query.controller';
import { historyQuerySchema } from '../controllers/validators/oibus-validation-schema';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryLightDTO
} from 'shared/model/history-query.model';
import { NorthSettings } from 'shared/model/north-settings.model';
import { TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';

const joiValidator = new JoiValidator();
const historyQueryController = new HistoryQueryController(joiValidator, historyQuerySchema);

const router = new Router();

const storage = multer.diskStorage({
  filename(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // Adjust field size limit as needed
    fileSize: 20 * 1024 * 1024 // Adjust file size limit as needed
  }
});

router.get('/api/history-queries', (ctx: KoaContext<void, Array<HistoryQueryLightDTO>>) => historyQueryController.findAll(ctx));
router.get('/api/history-queries/:id', (ctx: KoaContext<void, HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>) =>
  historyQueryController.findById(ctx)
);
router.post(
  '/api/history-queries',
  (
    ctx: KoaContext<
      HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
      HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>
    >
  ) => historyQueryController.createHistoryQuery(ctx)
);
router.put('/api/history-queries/:id/start', (ctx: KoaContext<void, void>) => historyQueryController.startHistoryQuery(ctx));
router.put('/api/history-queries/:id/pause', (ctx: KoaContext<void, void>) => historyQueryController.pauseHistoryQuery(ctx));
router.put('/api/history-queries/:id', (ctx: KoaContext<HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>, void>) =>
  historyQueryController.updateHistoryQuery(ctx)
);
router.delete('/api/history-queries/:id', (ctx: KoaContext<void, void>) => historyQueryController.deleteHistoryQuery(ctx));
router.put('/api/history-queries/:historyQueryId/transformers', (ctx: KoaContext<TransformerDTOWithOptions, void>) =>
  historyQueryController.addOrEditTransformer(ctx)
);
router.delete('/api/history-queries/:historyQueryId/transformers/:transformerId', (ctx: KoaContext<void, void>) =>
  historyQueryController.removeTransformer(ctx)
);
router.get('/api/history-queries/:historyQueryId/south-items', (ctx: KoaContext<void, Page<HistoryQueryItemDTO<SouthItemSettings>>>) =>
  historyQueryController.searchHistoryQueryItems(ctx)
);
router.post(
  '/api/history-queries/:southType/south-items/check-south-import/:historyQueryId',
  upload.fields([
    { name: 'file', maxCount: 1 }, // Single file field
    { name: 'currentItems', maxCount: 1 } // Another file field for currentItems
  ]),
  (
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>;
        errors: Array<{ item: HistoryQueryItemCommandDTO<SouthItemSettings>; error: string }>;
      }
    >
  ) => historyQueryController.checkImportSouthItems(ctx)
);
router.post(
  '/api/history-queries/:historyQueryId/south-items/import',
  upload.fields([{ name: 'items', maxCount: 1 }]),
  (ctx: KoaContext<void, void>) => historyQueryController.importSouthItems(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/export', (ctx: KoaContext<{ delimiter: string }, string>) =>
  historyQueryController.exportSouthItems(ctx)
);
router.put(
  '/api/history-queries/:southType/south-items/to-csv',
  upload.fields([{ name: 'items', maxCount: 1 }]),
  (ctx: KoaContext<{ delimiter: string }, string>) => historyQueryController.historyQueryItemsToCsv(ctx)
);

router.get('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<void, HistoryQueryItemDTO<SouthItemSettings>>) =>
  historyQueryController.getHistoryQueryItem(ctx)
);
router.post(
  '/api/history-queries/:historyQueryId/south-items',
  (ctx: KoaContext<HistoryQueryItemCommandDTO<SouthItemSettings>, HistoryQueryItemDTO<SouthItemSettings>>) =>
    historyQueryController.createHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<HistoryQueryItemCommandDTO<SouthItemSettings>, void>) =>
  historyQueryController.updateHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id/enable', (ctx: KoaContext<void, void>) =>
  historyQueryController.enableHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id/disable', (ctx: KoaContext<void, void>) =>
  historyQueryController.disableHistoryQueryItem(ctx)
);
router.delete('/api/history-queries/:historyQueryId/south-items/all', (ctx: KoaContext<void, void>) =>
  historyQueryController.deleteAllItems(ctx)
);
router.delete('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<void, void>) =>
  historyQueryController.deleteHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:id/south/test-connection', (ctx: KoaContext<SouthSettings, void>) =>
  historyQueryController.testSouthConnection(ctx)
);

router.put('/api/history-queries/:id/north/test-connection', (ctx: KoaContext<NorthSettings, void>) =>
  historyQueryController.testNorthConnection(ctx)
);

router.put(
  '/api/history-queries/:id/south/items/test-item',
  (
    ctx: KoaContext<
      {
        southSettings: SouthSettings;
        itemSettings: SouthItemSettings;
        testingSettings: SouthConnectorItemTestingSettings;
      },
      void
    >
  ) => historyQueryController.testHistoryQueryItem(ctx)
);
router.get(
  '/api/history-query/:historyQueryId/cache/content',
  (ctx: KoaContext<void, Array<{ metadataFilename: string; metadata: CacheMetadata }>>) => historyQueryController.searchCacheContent(ctx)
);
router.get('/api/history-query/:historyQueryId/cache/content/:filename', (ctx: KoaContext<void, ReadStream>) =>
  historyQueryController.getCacheContentFileStream(ctx)
);
router.delete('/api/history-query/:historyQueryId/cache/content/remove', (ctx: KoaContext<Array<string>, void>) =>
  historyQueryController.removeCacheContent(ctx)
);
router.delete('/api/history-query/:historyQueryId/cache/content/remove-all', (ctx: KoaContext<void, void>) =>
  historyQueryController.removeAllCacheContent(ctx)
);
router.post('/api/history-query/:historyQueryId/cache/content/move', (ctx: KoaContext<Array<string>, void>) =>
  historyQueryController.moveCacheContent(ctx)
);
router.post('/api/history-query/:historyQueryId/cache/content/move-all', (ctx: KoaContext<void, void>) =>
  historyQueryController.moveAllCacheContent(ctx)
);
export default router;
