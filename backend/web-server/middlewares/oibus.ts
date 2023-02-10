import { KoaContext } from '../koa';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import ReloadService from '../../service/reload-service';

/**
 * OIBus middleware for Koa
 */
const oibus = (
  id: string,
  repositoryService: RepositoryService,
  reloadService: ReloadService,
  encryptionService: EncryptionService,
  logger: pino.Logger
) => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
    ctx.app.id = id;
    ctx.app.repositoryService = repositoryService;
    ctx.app.reloadService = reloadService;
    ctx.app.encryptionService = encryptionService;
    ctx.app.logger = logger;
    return next();
  };
};

export default oibus;
