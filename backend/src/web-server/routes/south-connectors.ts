import Router from '@koa/router';
import { KoaContext } from '../koa';
import JoiValidator from '../controllers/validators/joi.validator';
import SouthConnectorController from '../controllers/south-connector.controller';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthType
} from 'shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from 'shared/model/south-settings.model';
import { Page } from '../../../shared/model/types';
import multer from '@koa/multer';

const joiValidator = new JoiValidator();
const southConnectorController = new SouthConnectorController(joiValidator);

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

router.get('/api/south-types', (ctx: KoaContext<void, Array<SouthType>>) => southConnectorController.getSouthConnectorTypes(ctx));
router.get('/api/south-types/:id', (ctx: KoaContext<void, SouthConnectorManifest>) =>
  southConnectorController.getSouthConnectorManifest(ctx)
);

router.get('/api/south', (ctx: KoaContext<void, Array<SouthConnectorLightDTO>>) => southConnectorController.findAll(ctx));
router.put('/api/south/:id/test-connection', (ctx: KoaContext<SouthSettings, void>) => southConnectorController.testSouthConnection(ctx));

router.get('/api/south/:id', (ctx: KoaContext<void, SouthConnectorDTO<SouthSettings, SouthItemSettings>>) =>
  southConnectorController.findById(ctx)
);
router.post(
  '/api/south',
  (ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, SouthConnectorDTO<SouthSettings, SouthItemSettings>>) =>
    southConnectorController.createSouth(ctx)
);
router.put('/api/south/:id', (ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>) =>
  southConnectorController.updateSouth(ctx)
);
router.delete('/api/south/:id', (ctx: KoaContext<void, void>) => southConnectorController.delete(ctx));
router.put('/api/south/:id/start', (ctx: KoaContext<void, void>) => southConnectorController.start(ctx));
router.put('/api/south/:id/stop', (ctx: KoaContext<void, void>) => southConnectorController.stop(ctx));
router.put(
  '/api/south/:id/items/test-item',
  (
    ctx: KoaContext<
      {
        southSettings: SouthSettings;
        itemSettings: SouthItemSettings;
        testingSettings: SouthConnectorItemTestingSettings;
      },
      void
    >
  ) => southConnectorController.testSouthItem(ctx)
);
router.get('/api/south/:southId/items', (ctx: KoaContext<void, Page<SouthConnectorItemDTO<SouthItemSettings>>>) =>
  southConnectorController.searchSouthItems(ctx)
);
router.get('/api/south/:southId/items/all', (ctx: KoaContext<void, Array<SouthConnectorItemDTO<SouthItemSettings>>>) =>
  southConnectorController.listSouthItems(ctx)
);
router.post(
  '/api/south/:southId/items',
  (ctx: KoaContext<SouthConnectorItemCommandDTO<SouthItemSettings>, SouthConnectorItemDTO<SouthItemSettings>>) =>
    southConnectorController.createSouthItem(ctx)
);
router.post(
  '/api/south/:southType/items/check-import/:southId',
  upload.fields([
    { name: 'file', maxCount: 1 }, // Single file field
    { name: 'currentItems', maxCount: 1 } // Another file field for currentItems
  ]),
  (
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<SouthConnectorItemDTO<SouthItemSettings>>;
        errors: Array<{ item: Record<string, string>; error: string }>;
      }
    >
  ) => southConnectorController.checkImportSouthItems(ctx)
);
router.post('/api/south/:southId/items/import', upload.fields([{ name: 'items', maxCount: 1 }]), (ctx: KoaContext<void, void>) =>
  southConnectorController.importSouthItems(ctx)
);
router.put('/api/south/:southId/items/export', (ctx: KoaContext<{ delimiter: string }, string>) =>
  southConnectorController.exportSouthItems(ctx)
);
router.put(
  '/api/south/:southType/items/to-csv',
  upload.fields([{ name: 'items', maxCount: 1 }]),
  (ctx: KoaContext<{ delimiter: string }, string>) => southConnectorController.southConnectorItemsToCsv(ctx)
);
router.get('/api/south/:southId/items/:id', (ctx: KoaContext<void, SouthConnectorItemDTO<SouthItemSettings>>) =>
  southConnectorController.getSouthItem(ctx)
);
router.put('/api/south/:southId/items/:id', (ctx: KoaContext<SouthConnectorItemCommandDTO<SouthItemSettings>, void>) =>
  southConnectorController.updateSouthItem(ctx)
);
router.put('/api/south/:southId/items/:id/enable', (ctx: KoaContext<void, void>) => southConnectorController.enableSouthItem(ctx));
router.put('/api/south/:southId/items/:id/disable', (ctx: KoaContext<void, void>) => southConnectorController.disableSouthItem(ctx));
router.delete('/api/south/:southId/items/all', (ctx: KoaContext<void, void>) => southConnectorController.deleteAllSouthItem(ctx));
router.delete('/api/south/:southId/items/:id', (ctx: KoaContext<void, void>) => southConnectorController.deleteSouthItem(ctx));
router.put('/api/south/:southId/cache/reset-metrics', (ctx: KoaContext<void, void>) => southConnectorController.resetSouthMetrics(ctx));

export default router;
