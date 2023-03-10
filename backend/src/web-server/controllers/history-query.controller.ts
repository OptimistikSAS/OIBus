import { KoaContext } from '../koa';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../../shared/model/history-query.model';

const getHistoryQueries = (ctx: KoaContext<void, Array<HistoryQueryDTO>>) => {
  const historyQueries = ctx.app.repositoryService.historyQueryRepository.getHistoryQueries();
  ctx.ok(historyQueries);
};

const getHistoryQuery = (ctx: KoaContext<void, HistoryQueryDTO>) => {
  const historyQuery = ctx.app.repositoryService.historyQueryRepository.getHistoryQuery(ctx.params.id);
  ctx.ok(historyQuery);
};

const createHistoryQuery = (ctx: KoaContext<HistoryQueryCommandDTO, void>) => {
  const command: HistoryQueryCommandDTO | undefined = ctx.request.body;
  if (command) {
    const historyQuery = ctx.app.repositoryService.historyQueryRepository.createHistoryQuery(command);
    ctx.created(historyQuery);
  } else {
    ctx.badRequest();
  }
};

const updateHistoryQuery = async (ctx: KoaContext<HistoryQueryCommandDTO, void>) => {
  const command: HistoryQueryCommandDTO | undefined = ctx.request.body;
  if (command) {
    ctx.app.repositoryService.historyQueryRepository.updateHistoryQuery(ctx.params.id, command);
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

const deleteHistoryQuery = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.historyQueryRepository.deleteHistoryQuery(ctx.params.id);
  ctx.noContent();
};

export default {
  getHistoryQueries,
  getHistoryQuery,
  createHistoryQuery,
  updateHistoryQuery,
  deleteHistoryQuery
};
