import { KoaContext } from '../koa';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO
} from '../../../shared/model/history-query.model';
import JoiValidator from './validators/joi.validator';

import { SouthConnectorCommandDTO } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import AbstractController from './abstract.controller';
import Joi from 'joi';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import { toHistoryQueryDTO, toHistoryQueryItemDTO, toHistoryQueryLightDTO } from '../../service/history-query.service';
import { itemToFlattenedCSV } from '../../service/utils';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

export default class HistoryQueryController extends AbstractController {
  constructor(
    protected readonly validator: JoiValidator,
    protected readonly schema: Joi.ObjectSchema
  ) {
    super(validator, schema);
  }

  async findAll(ctx: KoaContext<void, Array<HistoryQueryLightDTO>>): Promise<void> {
    const historyQueries = ctx.app.historyQueryService.findAll();
    ctx.ok(historyQueries.map(historyQuery => toHistoryQueryLightDTO(historyQuery)));
  }

  async findById(ctx: KoaContext<void, HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.id);
    if (!historyQuery) {
      return ctx.notFound();
    }
    return ctx.ok(toHistoryQueryDTO(historyQuery, ctx.app.encryptionService));
  }

  async createHistoryQuery(
    ctx: KoaContext<
      HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
      HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>
    >
  ): Promise<void> {
    try {
      const historyQuery = toHistoryQueryDTO(
        await ctx.app.historyQueryService.createHistoryQuery(ctx.request.body!),
        ctx.app.encryptionService
      );
      ctx.created(historyQuery);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  updateHistoryQuery = async (ctx: KoaContext<HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>, void>) => {
    try {
      await ctx.app.historyQueryService.updateHistoryQuery(ctx.params.id, ctx.request.body!, ctx.query.resetCache === 'true');
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  };

  deleteHistoryQuery = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.historyQueryService.deleteHistoryQuery(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  };

  startHistoryQuery = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.historyQueryService.startHistoryQuery(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  };

  pauseHistoryQuery = async (ctx: KoaContext<void, void>) => {
    try {
      await ctx.app.historyQueryService.pauseHistoryQuery(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  };

  async testSouthConnection(ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>) {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.historyQueryService.testSouth(ctx.params.id, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async testHistoryQueryItem(
    ctx: KoaContext<
      { south: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>; item: HistoryQueryItemCommandDTO<SouthItemSettings> },
      void
    >
  ) {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.historyQueryService.testSouthItem(ctx.params.id, ctx.request.body!.south, ctx.request.body!.item, ctx.ok, logger);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async testNorthConnection(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>) {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.historyQueryService.testNorth(ctx.params.id, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async searchHistoryQueryItems(ctx: KoaContext<void, Page<HistoryQueryItemDTO<SouthItemSettings>>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    const searchParams: HistoryQueryItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name as string | undefined
    };
    const page = ctx.app.historyQueryService.searchHistoryQueryItems(ctx.params.historyQueryId, searchParams);
    ctx.ok({
      content: page.content.map(item => toHistoryQueryItemDTO(item, historyQuery.southType, ctx.app.encryptionService)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async getHistoryQueryItem(ctx: KoaContext<void, HistoryQueryItemDTO<SouthItemSettings>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    const historyQueryItem = ctx.app.historyQueryService.findHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
    if (historyQueryItem) {
      ctx.ok(toHistoryQueryItemDTO(historyQueryItem, historyQuery.southType, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async createHistoryQueryItem(
    ctx: KoaContext<HistoryQueryItemCommandDTO<SouthItemSettings>, HistoryQueryItemDTO<SouthItemSettings>>
  ): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }
    try {
      const item = await ctx.app.historyQueryService.createHistoryQueryItem(ctx.params.historyQueryId, ctx.request.body!);
      ctx.created(toHistoryQueryItemDTO(item, historyQuery.southType, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateHistoryQueryItem(ctx: KoaContext<HistoryQueryItemCommandDTO<SouthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.updateHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async enableHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.enableHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async disableHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.disableHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.deleteHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteAllItems(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.deleteAllItemsForHistoryQuery(ctx.params.historyQueryId);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  /**
   * Endpoint used to download a CSV from a list of items when creating a history query (before the items are saved on
   * the database). When the items are already saved, it is downloaded with the export method
   */
  async historyQueryItemsToCsv(
    ctx: KoaContext<{ items: Array<HistoryQueryItemDTO<SouthItemSettings>>; delimiter: string }, string>
  ): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.southType);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    ctx.body = itemToFlattenedCSV(
      ctx.request.body!.items.map(item => toHistoryQueryItemDTO(item, manifest.id, ctx.app.encryptionService)),
      ctx.request.body!.delimiter
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async exportSouthItems(ctx: KoaContext<{ delimiter: string }, string>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    ctx.body = itemToFlattenedCSV(
      historyQuery.items.map(item => {
        return toHistoryQueryItemDTO(item, historyQuery.southType, ctx.app.encryptionService);
      }),
      ctx.request.body!.delimiter
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async checkImportSouthItems(
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>;
        errors: Array<{ item: HistoryQueryItemCommandDTO<SouthItemSettings>; error: string }>;
      }
    >
  ): Promise<void> {
    try {
      return ctx.ok(
        await ctx.app.historyQueryService.checkCsvImport(
          ctx.params.southType,
          ctx.request.file,
          ctx.request.body!.delimiter,
          JSON.parse(ctx.request.body!.currentItems)
        )
      );
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
  }

  async importSouthItems(ctx: KoaContext<{ items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> }, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.importItems(ctx.params.historyQueryId, ctx.request.body!.items);
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
    ctx.noContent();
  }
}
