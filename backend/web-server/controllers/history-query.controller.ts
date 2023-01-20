import { KoaContext } from "../koa";
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
} from "../../model/history-query.model";

const getHistoryQueries = (ctx: KoaContext<void, Array<HistoryQueryDTO>>) => {
  const historyQueries =
    ctx.app.repositoryService.historyQueryRepository.getHistoryQueries();
  ctx.ok(historyQueries);
};

const getHistoryQuery = (ctx: KoaContext<void, HistoryQueryDTO>) => {
  const historyQuery =
    ctx.app.repositoryService.historyQueryRepository.getHistoryQuery(
      ctx.params.id
    );
  ctx.ok(historyQuery);
};

const createHistoryQuery = (ctx: KoaContext<HistoryQueryCommandDTO, void>) => {
  const historyQuery =
    ctx.app.repositoryService.historyQueryRepository.createHistoryQuery(
      ctx.request.body
    );
  ctx.ok(historyQuery);
};

const updateHistoryQuery = async (
  ctx: KoaContext<HistoryQueryCommandDTO, void>
) => {
  ctx.app.repositoryService.historyQueryRepository.updateHistoryQuery(
    ctx.params.id,
    ctx.request.body
  );
  ctx.noContent();
};

const deleteHistoryQuery = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.historyQueryRepository.deleteHistoryQuery(
    ctx.params.id
  );
  ctx.noContent();
};

export default {
  getHistoryQueries,
  getHistoryQuery,
  createHistoryQuery,
  updateHistoryQuery,
  deleteHistoryQuery,
};
