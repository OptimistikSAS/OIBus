import { KoaContext } from '../koa';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQuerySouthItemCommandDTO,
  HistoryQuerySouthItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO,
  HistoryQueryNorthItemDTO,
  HistoryQueryNorthItemCommandDTO
} from '../../../shared/model/history-query.model';
import JoiValidator from './validators/joi.validator';

import { SouthConnectorCommandDTO, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import AbstractController from './abstract.controller';
import Joi from 'joi';
import {
  toHistoryQueryDTO,
  toSouthHistoryQueryItemDTO,
  toHistoryQueryLightDTO,
  toNorthHistoryQueryItemDTO
} from '../../service/history-query.service';
import { northItemToFlattenedCSV, southItemToFlattenedCSV } from '../../service/utils';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';

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

  async findById(
    ctx: KoaContext<void, HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>>
  ): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.id);
    if (!historyQuery) {
      return ctx.notFound();
    }
    return ctx.ok(toHistoryQueryDTO(historyQuery, ctx.app.encryptionService));
  }

  async createHistoryQuery(
    ctx: KoaContext<
      HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>,
      HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>
    >
  ): Promise<void> {
    try {
      const historyQuery = toHistoryQueryDTO(
        await ctx.app.historyQueryService.createHistoryQuery(
          ctx.request.body!,
          (ctx.query.fromSouth as string) || null,
          (ctx.query.fromNorth as string) || null,
          (ctx.query.duplicate as string) || null
        ),
        ctx.app.encryptionService
      );
      ctx.created(historyQuery);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  updateHistoryQuery = async (
    ctx: KoaContext<HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>, void>
  ) => {
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
      await ctx.app.historyQueryService.testSouth(ctx.params.id, (ctx.query.fromSouth as string) || null, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async testSouthHistoryQueryItem(
    ctx: KoaContext<
      {
        south: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
        item: HistoryQuerySouthItemCommandDTO<SouthItemSettings>;
        testingSettings: SouthConnectorItemTestingSettings;
      },
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
      await ctx.app.historyQueryService.testSouthItem(
        ctx.params.id,
        (ctx.query.fromSouth as string) || null,
        ctx.request.body!.south,
        ctx.request.body!.item,
        ctx.request.body!.testingSettings,
        ctx.ok,
        logger
      );
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async testNorthConnection(ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>, void>) {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.historyQueryService.testNorth(ctx.params.id, (ctx.query.fromNorth as string) || null, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async searchSouthHistoryQueryItems(ctx: KoaContext<void, Page<HistoryQuerySouthItemDTO<SouthItemSettings>>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    const searchParams: HistoryQueryItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name as string | undefined
    };
    const page = ctx.app.historyQueryService.searchSouthHistoryQueryItems(ctx.params.historyQueryId, searchParams);
    ctx.ok({
      content: page.content.map(item => toSouthHistoryQueryItemDTO(item, historyQuery.southType, ctx.app.encryptionService)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async searchNorthHistoryQueryItems(ctx: KoaContext<void, Page<HistoryQueryNorthItemDTO<NorthItemSettings>>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    const searchParams: HistoryQueryItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name as string | undefined
    };
    const page = ctx.app.historyQueryService.searchNorthHistoryQueryItems(ctx.params.historyQueryId, searchParams);
    ctx.ok({
      content: page.content.map(item => toNorthHistoryQueryItemDTO(item, historyQuery.northType, ctx.app.encryptionService)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async getSouthHistoryQueryItem(ctx: KoaContext<void, HistoryQuerySouthItemDTO<SouthItemSettings>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    const historyQueryItem = ctx.app.historyQueryService.findSouthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
    if (historyQueryItem) {
      ctx.ok(toSouthHistoryQueryItemDTO(historyQueryItem, historyQuery.southType, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async getNorthHistoryQueryItem(ctx: KoaContext<void, HistoryQueryNorthItemDTO<NorthItemSettings>>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    const historyQueryItem = ctx.app.historyQueryService.findNorthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
    if (historyQueryItem) {
      ctx.ok(toNorthHistoryQueryItemDTO(historyQueryItem, historyQuery.northType, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async createSouthHistoryQueryItem(
    ctx: KoaContext<HistoryQuerySouthItemCommandDTO<SouthItemSettings>, HistoryQuerySouthItemDTO<SouthItemSettings>>
  ): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }
    try {
      const item = await ctx.app.historyQueryService.createSouthHistoryQueryItem(ctx.params.historyQueryId, ctx.request.body!);
      ctx.created(toSouthHistoryQueryItemDTO(item, historyQuery.southType, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async createNorthHistoryQueryItem(
    ctx: KoaContext<HistoryQueryNorthItemCommandDTO<NorthItemSettings>, HistoryQueryNorthItemDTO<NorthItemSettings>>
  ): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }
    try {
      const item = await ctx.app.historyQueryService.createNorthHistoryQueryItem(ctx.params.historyQueryId, ctx.request.body!);
      ctx.created(toNorthHistoryQueryItemDTO(item, historyQuery.northType, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateSouthHistoryQueryItem(ctx: KoaContext<HistoryQuerySouthItemCommandDTO<SouthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.updateSouthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateNorthHistoryQueryItem(ctx: KoaContext<HistoryQueryNorthItemCommandDTO<NorthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.updateNorthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async enableSouthHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.enableSouthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async enableNorthHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.enableNorthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async disableSouthHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.disableSouthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async disableNorthHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.disableNorthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteSouthHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.deleteSouthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteNorthHistoryQueryItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.deleteNorthHistoryQueryItem(ctx.params.historyQueryId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteAllSouthItems(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.deleteAllSouthItemsForHistoryQuery(ctx.params.historyQueryId);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteAllNorthItems(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.deleteAllNorthItemsForHistoryQuery(ctx.params.historyQueryId);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  /**
   * Endpoint used to download a CSV from a list of items when creating a history query (before the items are saved on
   * the database). When the items are already saved, it is downloaded with the export method
   */
  async historyQuerySouthItemsToCsv(
    ctx: KoaContext<{ items: Array<HistoryQuerySouthItemDTO<SouthItemSettings>>; delimiter: string }, string>
  ): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.southType);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    ctx.body = southItemToFlattenedCSV(
      ctx.request.body!.items.map(item => toSouthHistoryQueryItemDTO(item, manifest.id, ctx.app.encryptionService)),
      ctx.request.body!.delimiter
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  /**
   * Endpoint used to download a CSV from a list of items when creating a history query (before the items are saved on
   * the database). When the items are already saved, it is downloaded with the export method
   */
  async historyQueryNorthItemsToCsv(
    ctx: KoaContext<{ items: Array<HistoryQueryNorthItemDTO<NorthItemSettings>>; delimiter: string }, string>
  ): Promise<void> {
    const manifest = ctx.app.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === ctx.params.northType);
    if (!manifest) {
      return ctx.throw(404, 'North manifest not found');
    }

    ctx.body = northItemToFlattenedCSV(
      ctx.request.body!.items.map(item => toNorthHistoryQueryItemDTO(item, manifest.id, ctx.app.encryptionService)),
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

    ctx.body = southItemToFlattenedCSV(
      historyQuery.southItems.map(item => {
        return toSouthHistoryQueryItemDTO(item, historyQuery.southType, ctx.app.encryptionService);
      }),
      ctx.request.body!.delimiter
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async exportNorthItems(ctx: KoaContext<{ delimiter: string }, string>): Promise<void> {
    const historyQuery = ctx.app.historyQueryService.findById(ctx.params.historyQueryId);
    if (!historyQuery) {
      return ctx.notFound();
    }

    ctx.body = northItemToFlattenedCSV(
      historyQuery.northItems.map(item => {
        return toNorthHistoryQueryItemDTO(item, historyQuery.northType, ctx.app.encryptionService);
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
        items: Array<HistoryQuerySouthItemCommandDTO<SouthItemSettings>>;
        errors: Array<{ item: HistoryQuerySouthItemCommandDTO<SouthItemSettings>; error: string }>;
      }
    >
  ): Promise<void> {
    try {
      return ctx.ok(
        await ctx.app.historyQueryService.checkSouthCsvFileImport(
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

  async checkImportNorthItems(
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<HistoryQueryNorthItemCommandDTO<NorthItemSettings>>;
        errors: Array<{ item: HistoryQueryNorthItemCommandDTO<NorthItemSettings>; error: string }>;
      }
    >
  ): Promise<void> {
    try {
      return ctx.ok(
        await ctx.app.historyQueryService.checkNorthCsvFileImport(
          ctx.params.northType,
          ctx.request.file,
          ctx.request.body!.delimiter,
          JSON.parse(ctx.request.body!.currentItems)
        )
      );
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
  }

  async importSouthItems(ctx: KoaContext<{ items: Array<HistoryQuerySouthItemCommandDTO<SouthItemSettings>> }, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.importSouthItems(ctx.params.historyQueryId, ctx.request.body!.items);
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
    ctx.noContent();
  }

  async importNorthItems(ctx: KoaContext<{ items: Array<HistoryQueryNorthItemCommandDTO<NorthItemSettings>> }, void>): Promise<void> {
    try {
      await ctx.app.historyQueryService.importNorthItems(ctx.params.historyQueryId, ctx.request.body!.items);
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
    ctx.noContent();
  }
}
