import { KoaContext } from '../koa';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../../shared/model/external-sources.model';

const getExternalSources = async (ctx: KoaContext<void, Array<ExternalSourceDTO>>) => {
  const externalSources = ctx.app.repositoryService.externalSourceRepository.getExternalSources();
  ctx.ok(externalSources);
};

const getExternalSource = async (ctx: KoaContext<void, ExternalSourceDTO>) => {
  const externalSource = ctx.app.repositoryService.externalSourceRepository.getExternalSource(ctx.params.id);
  ctx.ok(externalSource);
};

const createExternalSource = async (ctx: KoaContext<ExternalSourceCommandDTO, void>) => {
  const command: ExternalSourceCommandDTO | undefined = ctx.request.body;
  if (command) {
    const externalSource = ctx.app.repositoryService.externalSourceRepository.createExternalSource(command);
    ctx.created(externalSource);
  } else {
    ctx.badRequest();
  }
};

const updateExternalSource = async (ctx: KoaContext<ExternalSourceCommandDTO, void>) => {
  const command: ExternalSourceCommandDTO | undefined = ctx.request.body;
  if (command) {
    ctx.app.repositoryService.externalSourceRepository.updateExternalSource(ctx.params.id, command);
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

const deleteExternalSource = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.externalSourceRepository.deleteExternalSource(ctx.params.id);
  ctx.noContent();
};

export default {
  getExternalSources,
  getExternalSource,
  createExternalSource,
  updateExternalSource,
  deleteExternalSource
};
