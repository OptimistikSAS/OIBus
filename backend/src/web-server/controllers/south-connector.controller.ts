import { KoaContext } from '../koa';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthConnectorWithoutItemsCommandDTO,
  SouthType
} from '../../../../shared/model/south-connector.model';
import { Page } from '../../../../shared/model/types';
import JoiValidator from './validators/joi.validator';
import { toSouthConnectorDTO, toSouthConnectorItemDTO, toSouthConnectorLightDTO } from '../../service/south.service';
import { itemToFlattenedCSV } from '../../service/utils';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';

export default class SouthConnectorController {
  constructor(protected readonly validator: JoiValidator) {}

  async getSouthConnectorTypes(ctx: KoaContext<void, Array<SouthType>>): Promise<void> {
    ctx.ok(
      ctx.app.southService.getInstalledSouthManifests().map(manifest => ({
        id: manifest.id,
        category: manifest.category,
        name: manifest.name,
        description: manifest.description,
        modes: manifest.modes
      }))
    );
  }

  async getSouthConnectorManifest(ctx: KoaContext<void, SouthConnectorManifest>): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.id);
    if (!manifest) {
      ctx.throw(404, 'South not found');
    }
    ctx.ok(manifest);
  }

  async findAll(ctx: KoaContext<void, Array<SouthConnectorLightDTO>>): Promise<void> {
    const southConnectors = ctx.app.southService.findAll().map(connector => toSouthConnectorLightDTO(connector));
    ctx.ok(southConnectors);
  }

  async findById(ctx: KoaContext<void, SouthConnectorDTO<SouthSettings, SouthItemSettings>>): Promise<void> {
    const southConnector = ctx.app.southService.findById(ctx.params.id);
    if (!southConnector) {
      return ctx.notFound();
    }
    ctx.ok(toSouthConnectorDTO(southConnector, ctx.app.encryptionService));
  }

  async createSouth(
    ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, SouthConnectorDTO<SouthSettings, SouthItemSettings>>
  ): Promise<void> {
    try {
      const southConnector = toSouthConnectorDTO(await ctx.app.southService.createSouth(ctx.request.body!), ctx.app.encryptionService);
      ctx.created(southConnector);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateSouthWithoutItems(ctx: KoaContext<SouthConnectorWithoutItemsCommandDTO<SouthSettings>, void>): Promise<void> {
    try {
      await ctx.app.southService.updateSouthWithoutItems(ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateSouth(ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.southService.updateSouth(ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.deleteSouth(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async start(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.startSouth(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async stop(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.stopSouth(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async resetSouthMetrics(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.oIBusService.resetSouthConnectorMetrics(ctx.params.southId);
    ctx.noContent();
  }

  async testSouthConnection(ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>): Promise<void> {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.southService.testSouth(ctx.params.id, ctx.request.body!, logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async testSouthItem(
    ctx: KoaContext<
      { south: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>; item: SouthConnectorItemCommandDTO<SouthItemSettings> },
      void
    >
  ): Promise<void> {
    try {
      const logger = ctx.app.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      );
      await ctx.app.southService.testSouthItem(ctx.params.id, ctx.request.body!.south, ctx.request.body!.item, ctx.ok, logger);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async listSouthItems(ctx: KoaContext<void, Array<SouthConnectorItemDTO<SouthItemSettings>>>): Promise<void> {
    const southConnector = ctx.app.southService.findById(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }
    const southItems = ctx.app.southService
      .getSouthItems(ctx.params.southId)
      .map(item => toSouthConnectorItemDTO(item, southConnector.type, ctx.app.encryptionService));
    ctx.ok(southItems);
  }

  async searchSouthItems(ctx: KoaContext<void, Page<SouthConnectorItemDTO<SouthItemSettings>>>): Promise<void> {
    const southConnector = ctx.app.southService.findById(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }
    const searchParams: SouthConnectorItemSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      name: ctx.query.name as string | undefined
    };
    const page = ctx.app.southService.searchSouthItems(ctx.params.southId, searchParams);
    ctx.ok({
      content: page.content.map(item => toSouthConnectorItemDTO(item, southConnector.type, ctx.app.encryptionService)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async getSouthItem(ctx: KoaContext<void, SouthConnectorItemDTO<SouthItemSettings>>): Promise<void> {
    const southConnector = ctx.app.southService.findById(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }
    const item = ctx.app.southService.findSouthConnectorItemById(ctx.params.southId, ctx.params.id);
    if (item) {
      ctx.ok(toSouthConnectorItemDTO(item, southConnector.type, ctx.app.encryptionService));
    } else {
      ctx.notFound();
    }
  }

  async createSouthItem(
    ctx: KoaContext<SouthConnectorItemCommandDTO<SouthItemSettings>, SouthConnectorItemDTO<SouthItemSettings>>
  ): Promise<void> {
    const southConnector = ctx.app.southService.findById(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }
    try {
      const item = await ctx.app.southService.createItem(ctx.params.southId!, ctx.request.body!);
      ctx.created(toSouthConnectorItemDTO(item, southConnector.type, ctx.app.encryptionService));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateSouthItem(ctx: KoaContext<SouthConnectorItemCommandDTO<SouthItemSettings>, void>): Promise<void> {
    try {
      await ctx.app.southService.updateItem(ctx.params.southId!, ctx.params.id!, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.deleteItem(ctx.params.southId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async enableSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.enableItem(ctx.params.southId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async disableSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.disableItem(ctx.params.southId, ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async deleteAllSouthItem(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.southService.deleteAllItemsForSouthConnector(ctx.params.southId);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  /**
   * Endpoint used to download a CSV from a list of items when creating a South Connector (before the items are saved on
   * the database). When the items are already saved, it is downloaded with the export method
   */
  async southConnectorItemsToCsv(
    ctx: KoaContext<{ items: Array<SouthConnectorItemDTO<SouthItemSettings>>; delimiter: string }, string>
  ): Promise<void> {
    const manifest = ctx.app.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === ctx.params.southType);
    if (!manifest) {
      return ctx.throw(404, 'South manifest not found');
    }

    ctx.body = itemToFlattenedCSV(
      ctx.request.body!.items.map(item => toSouthConnectorItemDTO(item, manifest.id, ctx.app.encryptionService)),
      ctx.request.body!.delimiter,
      ctx.app.scanModeService.findAll()
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async exportSouthItems(ctx: KoaContext<{ delimiter: string }, string>): Promise<void> {
    const southConnector = ctx.app.southService.findById(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }

    ctx.body = itemToFlattenedCSV(
      southConnector.items.map(item => toSouthConnectorItemDTO(item, southConnector.type, ctx.app.encryptionService)),
      ctx.request.body!.delimiter,
      ctx.app.scanModeService.findAll()
    );
    ctx.set('Content-disposition', 'attachment; filename=items.csv');
    ctx.set('Content-Type', 'application/force-download');
    ctx.ok();
  }

  async checkImportSouthItems(
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>;
        errors: Array<{ item: SouthConnectorItemCommandDTO<SouthItemSettings>; error: string }>;
      }
    >
  ): Promise<void> {
    try {
      return ctx.ok(
        await ctx.app.southService.checkCsvImport(
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

  async importSouthItems(ctx: KoaContext<{ items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> }, void>): Promise<void> {
    try {
      await ctx.app.southService.importItems(ctx.params.southId, ctx.request.body!.items);
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
    ctx.noContent();
  }
}
