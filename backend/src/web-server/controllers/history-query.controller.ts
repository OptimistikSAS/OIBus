import { KoaContext } from '../koa';
import { HistoryQueryCommandDTO, HistoryQueryCreateCommandDTO, HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import JoiValidator from '../../validators/joi.validator';

import {
  OibusItemCommandDTO,
  OibusItemDTO,
  OibusItemSearchParam,
  SouthConnectorManifest
} from '../../../../shared/model/south-connector.model';
import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';
import { Page } from '../../../../shared/model/types';

export default class HistoryQueryController {
  constructor(
    protected readonly validator: JoiValidator,
    private southManifests: Array<SouthConnectorManifest>,
    private northManifests: Array<NorthConnectorManifest>
  ) {}

  getHistoryQueries = (ctx: KoaContext<void, Array<HistoryQueryDTO>>) => {
    const historyQueries = ctx.app.repositoryService.historyQueryRepository.getHistoryQueries();
    ctx.ok(
      historyQueries.map(historyQuery => {
        const southManifest = this.southManifests.find(south => south.name === historyQuery.southType);
        const northManifest = this.northManifests.find(north => north.name === historyQuery.northType);
        if (southManifest && northManifest) {
          historyQuery.southSettings = ctx.app.encryptionService.filterSecrets(historyQuery.southSettings, southManifest.settings);
          historyQuery.northSettings = ctx.app.encryptionService.filterSecrets(historyQuery.northSettings, northManifest.settings);
          return historyQuery;
        }
        return null;
      })
    );
  };

  getHistoryQuery = (ctx: KoaContext<void, HistoryQueryDTO>) => {
    const historyQuery = ctx.app.repositoryService.historyQueryRepository.getHistoryQuery(ctx.params.id);
    if (!historyQuery) {
      return ctx.notFound();
    }
    const southManifest = this.southManifests.find(south => south.name === historyQuery.southType);
    const northManifest = this.northManifests.find(north => north.name === historyQuery.northType);
    if (southManifest && northManifest) {
      historyQuery.southSettings = ctx.app.encryptionService.filterSecrets(historyQuery.southSettings, southManifest.settings);
      historyQuery.northSettings = ctx.app.encryptionService.filterSecrets(historyQuery.northSettings, northManifest.settings);
      return ctx.ok(historyQuery);
    } else {
      ctx.notFound();
    }
  };

  createHistoryQuery = async (ctx: KoaContext<HistoryQueryCreateCommandDTO, void>) => {
    const command: HistoryQueryCommandDTO = {
      name: ctx.request.body?.name || '',
      description: ctx.request.body?.description || '',
      enabled: false,
      startTime: '',
      endTime: '',
      southType: '',
      northType: '',
      southSettings: {},
      northSettings: {},
      caching: {
        scanModeId: '',
        retryInterval: 5000,
        retryCount: 3,
        groupCount: 3000,
        maxSendCount: 10000,
        maxSize: 0
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };

    let southManifest: SouthConnectorManifest | undefined;
    let southItems: Array<OibusItemDTO> = [];
    if (ctx.request.body?.southType) {
      southManifest = this.southManifests.find(south => south.name === ctx.request.body?.southType);
      command.southType = ctx.request.body?.southType;
    } else if (ctx.request.body?.southId) {
      const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.request.body.southId);
      if (!southConnector) {
        return ctx.throw(404, 'South connector not found');
      }
      command.southSettings = southConnector.settings;
      command.southType = southConnector.type;
      southItems = ctx.app.repositoryService.southItemRepository.getSouthItems(ctx.request.body.southId);
      southManifest = this.southManifests.find(south => south.name === southConnector.type);
    }
    if (!southManifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    let northManifest: NorthConnectorManifest | undefined;
    if (ctx.request.body?.northType) {
      northManifest = this.northManifests.find(north => north.name === ctx.request.body?.northType);
      command.northType = ctx.request.body?.northType;
    } else if (ctx.request.body?.northId) {
      const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.request.body.northId);
      if (!northConnector) {
        return ctx.throw(404, 'North connector not found');
      }
      command.northSettings = northConnector.settings;
      command.caching = northConnector.caching;
      command.northType = northConnector.type;
      northManifest = this.northManifests.find(north => north.name === northConnector.type);
    }
    if (!northManifest) {
      return ctx.throw(404, 'North manifest not found');
    }

    try {
      const historyQuery = await ctx.app.reloadService.onCreateHistoryQuery(command, southItems);
      ctx.created(historyQuery);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  updateHistoryQuery = async (ctx: KoaContext<HistoryQueryCommandDTO, void>) => {
    const historyQuery = ctx.app.repositoryService.historyQueryRepository.getHistoryQuery(ctx.params.id);
    if (!historyQuery) {
      return ctx.notFound();
    }
    const southManifest = this.southManifests.find(south => south.name === historyQuery.southType);
    if (!southManifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    const northManifest = this.northManifests.find(north => north.name === historyQuery.northType);
    if (!northManifest) {
      return ctx.throw(404, 'North manifest not found');
    }

    const command = ctx.request.body as HistoryQueryCommandDTO;
    try {
      await this.validator.validateSettings(southManifest.settings, historyQuery.southSettings);
      await this.validator.validateSettings(northManifest.settings, historyQuery.northSettings);

      command.southSettings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.southSettings,
        historyQuery.southSettings,
        southManifest.settings
      );

      command.northSettings = await ctx.app.encryptionService.encryptConnectorSecrets(
        command.northSettings,
        historyQuery.northSettings,
        northManifest.settings
      );
      await ctx.app.reloadService.onUpdateHistoryQuerySettings(ctx.params.id, command);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  };

  deleteHistoryQuery = async (ctx: KoaContext<void, void>) => {
    await ctx.app.reloadService.onDeleteHistoryQuery(ctx.params.id);
    ctx.noContent();
  };

  async searchHistoryQueryItems(ctx: KoaContext<void, Page<OibusItemDTO>>): Promise<void> {
    const searchParams: OibusItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: (ctx.query.name as string) || null
    };
    const southItems = ctx.app.repositoryService.historyQueryItemRepository.searchHistoryItems(ctx.params.historyQueryId, searchParams);
    ctx.ok(southItems);
  }

  async getHistoryQueryItem(ctx: KoaContext<void, OibusItemDTO>): Promise<void> {
    const southItem = ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem(ctx.params.id);
    if (southItem) {
      ctx.ok(southItem);
    } else {
      ctx.notFound();
    }
  }

  async createHistoryQueryItem(ctx: KoaContext<OibusItemCommandDTO, OibusItemDTO>): Promise<void> {
    try {
      const historyQuery = ctx.app.repositoryService.historyQueryRepository.getHistoryQuery(ctx.params.historyQueryId);
      if (!historyQuery) {
        return ctx.throw(404, 'History query not found');
      }

      const manifest = this.southManifests.find(south => south.name === historyQuery.southType);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      const command: OibusItemCommandDTO | undefined = ctx.request.body;
      if (command) {
        await this.validator.validateSettings(manifest.items.settings, command?.settings);
        const historyQueryItem = await ctx.app.reloadService.onCreateHistoryItem(ctx.params.historyQueryId, command);
        ctx.created(historyQueryItem);
      } else {
        ctx.badRequest();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateHistoryQueryItem(ctx: KoaContext<OibusItemCommandDTO, void>): Promise<void> {
    try {
      const historyQuery = ctx.app.repositoryService.historyQueryRepository.getHistoryQuery(ctx.params.historyQueryId);
      if (!historyQuery) {
        return ctx.throw(404, 'History query not found');
      }

      const manifest = this.southManifests.find(south => south.name === historyQuery.southType);
      if (!manifest) {
        return ctx.throw(404, 'South manifest not found');
      }

      const historyQueryItem = ctx.app.repositoryService.historyQueryItemRepository.getHistoryItem(ctx.params.id);
      if (historyQueryItem) {
        const command: OibusItemCommandDTO | undefined = ctx.request.body;
        if (command) {
          await this.validator.validateSettings(manifest.items.settings, command?.settings);
          await ctx.app.reloadService.onUpdateHistoryItemsSettings(ctx.params.historyQueryId, historyQueryItem, command);
          ctx.noContent();
        } else {
          ctx.badRequest();
        }
      } else {
        ctx.notFound();
      }
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.reloadService.onDeleteHistoryItem(ctx.params.historyQueryId, ctx.params.id);
    ctx.noContent();
  }
}
