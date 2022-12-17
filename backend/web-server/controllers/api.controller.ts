import { KoaContext } from "../koa";
import {
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
} from "../../model/engine.model";
import { ProxyCommandDTO, ProxyDTO } from "../../model/proxy.model";
import { ScanModeCommandDTO, ScanModeDTO } from "../../model/scan-mode.model";
import { IpFilterCommandDTO, IpFilterDTO } from "../../model/ip-filter.model";
import {
  ExternalSourceCommandDTO,
  ExternalSourceDTO,
} from "../../model/external-sources.model";

const getEngineSettings = async (ctx: KoaContext<void, EngineSettingsDTO>) => {
  const settings =
    ctx.app.repositoryService.engineRepository.getEngineSettings();
  ctx.ok(settings);
};

const updateEngineSettings = async (
  ctx: KoaContext<EngineSettingsCommandDTO, void>
) => {
  ctx.app.repositoryService.engineRepository.updateEngineSettings(
    ctx.request.body
  );
  ctx.ok("Engine settings updated!");
};

const getProxies = async (ctx: KoaContext<void, Array<ProxyDTO>>) => {
  const proxies = ctx.app.repositoryService.proxyRepository.getProxies();
  ctx.ok(proxies);
};

const getProxy = async (ctx: KoaContext<void, ProxyDTO>) => {
  const proxy = ctx.app.repositoryService.proxyRepository.getProxy(
    ctx.params.id
  );
  ctx.ok(proxy);
};

const createProxy = async (ctx: KoaContext<ProxyCommandDTO, void>) => {
  ctx.app.repositoryService.proxyRepository.createProxy(ctx.request.body);
  ctx.ok("Proxy created!");
};

const updateProxy = async (ctx: KoaContext<ProxyCommandDTO, void>) => {
  ctx.app.repositoryService.proxyRepository.updateProxy(
    ctx.params.id,
    ctx.request.body
  );

  ctx.ok("Proxy updated!");
};

const deleteProxy = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.proxyRepository.deleteProxy(ctx.params.id);
  ctx.ok("Proxy deleted!");
};

const getScanModes = async (ctx: KoaContext<void, Array<ScanModeDTO>>) => {
  const scanModes = ctx.app.repositoryService.scanModeRepository.getScanModes();
  ctx.ok(scanModes);
};

const getScanMode = async (ctx: KoaContext<void, ScanModeDTO>) => {
  const scanMode = ctx.app.repositoryService.scanModeRepository.getScanMode(
    ctx.params.id
  );
  ctx.ok(scanMode);
};

const createScanMode = async (ctx: KoaContext<ScanModeCommandDTO, void>) => {
  ctx.app.repositoryService.scanModeRepository.createScanMode(ctx.request.body);
  ctx.ok("Scan mode created!");
};

const updateScanMode = async (ctx: KoaContext<ScanModeCommandDTO, void>) => {
  ctx.app.repositoryService.scanModeRepository.updateScanMode(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok("Scan mode updated!");
};

const deleteScanMode = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.scanModeRepository.deleteScanMode(ctx.params.id);
  ctx.ok("Scan mode deleted!");
};

const getIpFilters = async (ctx: KoaContext<void, Array<IpFilterDTO>>) => {
  const ipFilters = ctx.app.repositoryService.ipFilterRepository.getIpFilters();
  ctx.ok(ipFilters);
};

const getIpFilter = async (ctx: KoaContext<void, IpFilterDTO>) => {
  const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(
    ctx.params.id
  );
  ctx.ok(ipFilter);
};

const createIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  ctx.app.repositoryService.ipFilterRepository.createIpFilter(ctx.request.body);
  ctx.ok("IP Filter created!");
};

const updateIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  ctx.app.repositoryService.ipFilterRepository.updateIpFilter(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok("IP Filter updated!");
};

const deleteIpFilter = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.ipFilterRepository.deleteIpFilter(ctx.params.id);
  ctx.ok("IP Filter deleted!");
};

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
  ctx.app.repositoryService.externalSourceRepository.createExternalSource(
    ctx.request.body
  );
  ctx.ok("External source created!");
};

const updateExternalSource = async (
  ctx: KoaContext<ExternalSourceCommandDTO, void>
) => {
  ctx.app.repositoryService.externalSourceRepository.updateExternalSource(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok("External source updated!");
};

const deleteExternalSource = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.externalSourceRepository.deleteExternalSource(
    ctx.params.id
  );
  ctx.ok("External source deleted!");
};

export default {
  getEngineSettings,
  updateEngineSettings,
  getProxies,
  getProxy,
  createProxy,
  updateProxy,
  deleteProxy,
  getScanModes,
  getScanMode,
  createScanMode,
  updateScanMode,
  deleteScanMode,
  getIpFilters,
  getIpFilter,
  createIpFilter,
  updateIpFilter,
  deleteIpFilter,
  getExternalSources,
  getExternalSource,
  createExternalSource,
  updateExternalSource,
  deleteExternalSource,
};
