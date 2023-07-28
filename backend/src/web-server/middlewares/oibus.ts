import { KoaContext } from '../koa';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import ReloadService from '../../service/reload.service';
import OIBusService from '../../service/oibus.service';
import NorthService from '../../service/north.service';
import SouthService from '../../service/south.service';
import EngineMetricsService from '../../service/engine-metrics.service';

/**
 * OIBus middleware for Koa
 */
const oibus = (
  id: string,
  repositoryService: RepositoryService,
  reloadService: ReloadService,
  encryptionService: EncryptionService,
  southService: SouthService,
  northService: NorthService,
  oibusService: OIBusService,
  engineMetricsService: EngineMetricsService,
  logger: pino.Logger
) => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
    ctx.app.id = id;
    ctx.app.repositoryService = repositoryService;
    ctx.app.reloadService = reloadService;
    ctx.app.encryptionService = encryptionService;
    ctx.app.southService = southService;
    ctx.app.northService = northService;
    ctx.app.oibusService = oibusService;
    ctx.app.engineMetricsService = engineMetricsService;
    ctx.app.logger = logger;
    return next();
  };
};

export default oibus;
