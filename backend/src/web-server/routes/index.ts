import Router from '@koa/router';

import scanModesRouter from './scan-modes';
import certificatesRouter from './certificates';
import usersRouter from './users';
import engineRouter from './engine';
import registrationRouter from './registration';
import transformersRouter from './transformers';
import ipFiltersRouter from './ip-filters';
import northConnectorsRouter from './north-connectors';
import southConnectorsRouter from './south-connectors';
import historyQueriesRouter from './history-queries';
import logsRouter from './logs';
import commandsRouter from './commands';

const router = new Router();

router.use(engineRouter.routes());
router.use(northConnectorsRouter.routes());
router.use(southConnectorsRouter.routes());
router.use(historyQueriesRouter.routes());
router.use(registrationRouter.routes());
router.use(commandsRouter.routes());
router.use(certificatesRouter.routes());
router.use(ipFiltersRouter.routes());
router.use(scanModesRouter.routes());
router.use(transformersRouter.routes());
router.use(logsRouter.routes());
router.use(usersRouter.routes());

export default router;
