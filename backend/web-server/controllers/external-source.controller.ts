import { KoaContext } from "../koa";
import {
  ExternalSourceCommandDTO,
  ExternalSourceDTO,
} from "../../model/external-sources.model";

const getExternalSources = async (
  ctx: KoaContext<void, Array<ExternalSourceDTO>>
) => {
  const externalSources =
    ctx.app.repositoryService.externalSourceRepository.getExternalSources();
  ctx.ok(externalSources);
};

const getExternalSource = async (ctx: KoaContext<void, ExternalSourceDTO>) => {
  const externalSource =
    ctx.app.repositoryService.externalSourceRepository.getExternalSource(
      ctx.params.id
    );
  ctx.ok(externalSource);
};

const createExternalSource = async (
  ctx: KoaContext<ExternalSourceCommandDTO, void>
) => {
  const externalSource =
    ctx.app.repositoryService.externalSourceRepository.createExternalSource(
      ctx.request.body
    );
  ctx.created(externalSource);
};

const updateExternalSource = async (
  ctx: KoaContext<ExternalSourceCommandDTO, void>
) => {
  ctx.app.repositoryService.externalSourceRepository.updateExternalSource(
    ctx.params.id,
    ctx.request.body
  );
  ctx.noContent();
};

const deleteExternalSource = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.externalSourceRepository.deleteExternalSource(
    ctx.params.id
  );
  ctx.noContent();
};

export default {
  getExternalSources,
  getExternalSource,
  createExternalSource,
  updateExternalSource,
  deleteExternalSource,
};
