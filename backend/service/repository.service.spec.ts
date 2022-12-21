import db from "better-sqlite3";

import RepositoryService from "./repository.service";

import EngineRepository from "../repository/engine.repository";
import ExternalSourceRepository from "../repository/external-source.repository";
import IpFilterRepository from "../repository/ip-filter.repository";
import ProxyRepository from "../repository/proxy.repository";
import ScanModeRepository from "../repository/scan-mode.repository";

jest.mock("better-sqlite3", () => jest.fn(() => "sqlite database"));
jest.mock("../repository/external-source.repository");
jest.mock("../repository/ip-filter.repository");
jest.mock("../repository/proxy.repository");
jest.mock("../repository/scan-mode.repository");
jest.mock("../repository/engine.repository");

describe("Repository service", () => {
  it("should properly initialize service", () => {
    const repositoryService = new RepositoryService("myDatabase");
    expect(db).toHaveBeenCalledWith("myDatabase");
    expect(EngineRepository).toHaveBeenCalledWith("sqlite database");
    expect(ExternalSourceRepository).toHaveBeenCalledWith("sqlite database");
    expect(IpFilterRepository).toHaveBeenCalledWith("sqlite database");
    expect(ProxyRepository).toHaveBeenCalledWith("sqlite database");
    expect(ScanModeRepository).toHaveBeenCalledWith("sqlite database");

    expect(repositoryService.engineRepository).toBeDefined();
    expect(repositoryService.externalSourceRepository).toBeDefined();
    expect(repositoryService.ipFilterRepository).toBeDefined();
    expect(repositoryService.proxyRepository).toBeDefined();
    expect(repositoryService.scanModeRepository).toBeDefined();
  });
});
