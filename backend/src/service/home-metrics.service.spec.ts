import EngineMetricsRepositoryMock from '../tests/__mocks__/repository/log/engine-metrics-repository.mock';
import EngineMetricsRepository from '../repository/logs/engine-metrics.repository';
import HomeMetricsService from './home-metrics.service';
import { EventEmitter } from 'node:events';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

jest.mock('./utils');
jest.mock('./oibus.service');

let service: HomeMetricsService;
const engineMetricsRepository: EngineMetricsRepository = new EngineMetricsRepositoryMock();
const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

const northStream = new EventEmitter();
const southStream = new EventEmitter();
const createdSouth = {
  getMetricsDataStream: jest.fn().mockReturnValue(southStream)
};
const createdNorth = {
  getMetricsDataStream: jest.fn().mockReturnValue(northStream)
};
describe('HomeMetrics service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue({});
    service = new HomeMetricsService('id', engineMetricsRepository, northConnectorMetricsRepository, southConnectorMetricsRepository);
  });

  afterEach(() => {
    northStream.removeAllListeners();
    southStream.removeAllListeners();
  });

  it('should add North metrics', () => {
    (northConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({});
    service.addNorth(createdNorth as unknown as NorthConnector<NorthSettings>, 'id');

    const stream = service.stream;
    stream.write = jest.fn();
    service.addNorth(createdNorth as unknown as NorthConnector<NorthSettings>, 'id');
    // northStream.emit('data', `data: ${JSON.stringify({ northMetrics: 1 })}`);
    //
    // expect(stream.write).toHaveBeenCalledWith(
    //   `data: ${JSON.stringify({ norths: { id: { northMetrics: 1 } }, engine: {}, souths: {} })}\n\n`
    // );
    // service.removeNorth('id');
  });

  it('should add South metrics', () => {
    (southConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({});
    service.addSouth(createdSouth as unknown as SouthConnector<SouthSettings, SouthItemSettings>, 'id');

    const stream = service.stream;
    stream.write = jest.fn();
    service.addSouth(createdSouth as unknown as SouthConnector<SouthSettings, SouthItemSettings>, 'id');
    // southStream.emit('data', `data: ${JSON.stringify({ southMetrics: 1 })}`);
    //
    // expect(stream.write).toHaveBeenCalledWith(
    //   `data: ${JSON.stringify({ norths: {}, engine: {}, souths: { id: { southMetrics: 1 } } })}\n\n`
    // );
    // service.removeSouth('id');
  });
});
