import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HomeMetrics } from '@oibus/shared/api/engine.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { EngineService } from '../services/engine.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { SouthConnectorService } from '../services/south-connector.service';
import { provideCurrentUser } from '../shared/current-user-testing';
import { METRICS_REFRESH_INTERVAL_MS } from '../shared/polling';
import { HomeComponent } from './home.component';

class HomeComponentTester {
  readonly fixture = TestBed.createComponent(HomeComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly northTitle = this.root.getByRole('heading', { name: 'Enabled North' });
  readonly engineTitle = this.root.getByRole('heading', { name: 'Engine', exact: true });
  readonly southTitle = this.root.getByRole('heading', { name: 'Enabled South' });
  readonly engineMetrics = this.root.getByCss('oib-engine-metrics');
  readonly northMetrics = this.root.getByCss('oib-north-metrics');
  readonly southMetrics = this.root.getByCss('oib-south-metrics');
  readonly copyright = this.root.getByText(/^Copyright \(c\) 2018-\d{4} Optimistik SAS/);
}

describe('HomeComponent', () => {
  let southService: MockObject<SouthConnectorService>;
  let northService: MockObject<NorthConnectorService>;
  let engineService: MockObject<EngineService>;

  // the second connector of each list is disabled
  const [north1, north2] = testData.north.listLight;
  const [south1, south2, south3] = testData.south.listLight;
  const homeMetrics: HomeMetrics = {
    norths: { [north1.id]: testData.north.metrics, [north2.id]: testData.north.metrics },
    engine: testData.engine.metrics,
    souths: { [south1.id]: testData.south.metrics, [south2.id]: testData.south.metrics, [south3.id]: testData.south.metrics }
  };

  beforeEach(() => {
    southService = createMock(SouthConnectorService);
    northService = createMock(NorthConnectorService);
    engineService = createMock(EngineService);
    engineService.getHomeMetrics.mockReturnValue(of(homeMetrics));
    southService.list.mockReturnValue(of(testData.south.listLight));
    southService.getSouthManifest.mockReturnValue(of(testData.south.manifest));
    northService.list.mockReturnValue(of(testData.north.listLight));
    northService.getNorthManifest.mockReturnValue(of(testData.north.manifest));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        provideCurrentUser(),
        { provide: SouthConnectorService, useValue: southService },
        { provide: NorthConnectorService, useValue: northService },
        { provide: EngineService, useValue: engineService }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should display the titles and the copyright', async () => {
    const tester = new HomeComponentTester();

    await expect.element(tester.northTitle).toBeVisible();
    await expect.element(tester.engineTitle).toBeVisible();
    await expect.element(tester.southTitle).toBeVisible();
    await expect.element(tester.copyright).toMatchTextContent(`2018-${new Date().getFullYear()}`);
  });

  test('should display the metrics of the engine and of the enabled connectors only', async () => {
    const tester = new HomeComponentTester();

    await expect.element(tester.engineMetrics).toBeInTheDocument();
    await expect.element(tester.northMetrics).toHaveLength(1);
    await expect.element(tester.northMetrics).toMatchTextContent(`${north1.name} metrics`);
    await expect.element(tester.southMetrics).toHaveLength(2);
    await expect.element(tester.southMetrics.nth(0)).toMatchTextContent(`${south1.name} metrics`);
    await expect.element(tester.southMetrics.nth(1)).toMatchTextContent(`${south3.name} metrics`);
  });

  test('should not display the metrics of a connector without metrics', async () => {
    engineService.getHomeMetrics.mockReturnValue(of({ ...homeMetrics, norths: {}, souths: { [south3.id]: testData.south.metrics } }));
    const tester = new HomeComponentTester();

    await expect.element(tester.southMetrics).toHaveLength(1);
    await expect.element(tester.southMetrics).toMatchTextContent(`${south3.name} metrics`);
    await expect.element(tester.northMetrics).not.toBeInTheDocument();
  });

  test('should poll the home metrics', async () => {
    vi.useFakeTimers();
    engineService.getHomeMetrics.mockReturnValueOnce(of({ norths: {}, engine: testData.engine.metrics, souths: {} }));
    const tester = new HomeComponentTester();

    await vi.advanceTimersByTimeAsync(0);
    expect(engineService.getHomeMetrics).toHaveBeenCalledTimes(1);
    await expect.element(tester.engineMetrics).toBeInTheDocument();
    await expect.element(tester.northMetrics).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(METRICS_REFRESH_INTERVAL_MS);

    expect(engineService.getHomeMetrics).toHaveBeenCalledTimes(2);
    await expect.element(tester.northMetrics).toHaveLength(1);
    tester.fixture.destroy();
  });
});
