import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';

import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { buildWorkflow } from '../../../test/builders';
import { EmptyRouteComponent } from '../../../test/empty-route.component';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BreadcrumbComponent } from './breadcrumb.component';

/** The breadcrumb is displayed by the root component, above the router outlet */
@Component({
  template: `<oib-breadcrumb /><router-outlet />`,
  imports: [BreadcrumbComponent, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {}

const routes: Routes = [
  '',
  'north',
  'north/create',
  'north/:northId',
  'north/:northId/edit',
  'north/:northId/cache',
  'south',
  'south/create',
  'south/:southId',
  'south/:southId/edit',
  'south/:southId/workflows/:workflowId/history',
  'history-queries',
  'history-queries/create',
  'history-queries/:historyQueryId',
  'history-queries/:historyQueryId/edit',
  'history-queries/:historyQueryId/cache',
  'engine',
  'engine/edit',
  'engine/oianalytics',
  'logs',
  'about',
  'user-settings'
].map(path => ({ path, component: EmptyRouteComponent }));

class BreadcrumbComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly breadcrumbItems = this.root.getByRole('listitem');
  readonly breadcrumbLinks = this.root.getByRole('link');
}

describe('BreadcrumbComponent', () => {
  let tester: BreadcrumbComponentTester;
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  const north = testData.north.list[0];
  const south = testData.south.list[0];
  const historyQuery = testData.historyQueries.list[0];
  const workflow = buildWorkflow('workflow-1', 'Reactor discovery');

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    northConnectorService.findById.mockReturnValue(of(north));
    northConnectorService.getNorthManifest.mockReturnValue(of(testData.north.manifest));
    southConnectorService.findById.mockReturnValue(of(south));
    historyQueryService.findById.mockReturnValue(of(historyQuery));
    configurationWorkflowService.get.mockReturnValue(of(workflow));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideI18nTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService }
      ]
    });
  });

  /** Navigates before creating the component, so that the breadcrumb is built from the current route */
  async function createAt(url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    tester = new BreadcrumbComponentTester();
  }

  async function expectBreadcrumbTexts(texts: Array<string>) {
    await expect.element(tester.breadcrumbItems).toHaveLength(texts.length);
    for (const [index, text] of texts.entries()) {
      await expect.element(tester.breadcrumbItems.nth(index)).toHaveTextContent(text);
    }
  }

  test('should not show breadcrumbs on home page', async () => {
    await createAt('/');

    await expect.element(tester.root.getByRole('navigation')).not.toBeInTheDocument();
  });

  test.each([
    { url: '/north', expected: ['North'] },
    { url: '/north/create', expected: ['North', 'Create'] },
    { url: `/north/${north.id}`, expected: ['North', `${north.name} (console)`] },
    { url: `/north/${north.id}/edit`, expected: ['North', `${north.name} (console)`, 'Edit'] },
    { url: `/north/${north.id}/cache`, expected: ['North', `${north.name} (console)`, 'Cache'] },
    { url: '/south', expected: ['South'] },
    { url: '/south/create', expected: ['South', 'Create'] },
    { url: `/south/${south.id}`, expected: ['South', `${south.name} (${south.type})`] },
    { url: `/south/${south.id}/edit`, expected: ['South', `${south.name} (${south.type})`, 'Edit'] },
    {
      url: `/south/${south.id}/workflows/workflow-1/history`,
      expected: ['South', `${south.name} (${south.type})`, 'Reactor discovery', 'Run history']
    },
    { url: '/history-queries', expected: ['History'] },
    { url: '/history-queries/create', expected: ['History', 'Create'] },
    { url: `/history-queries/${historyQuery.id}`, expected: ['History', historyQuery.name] },
    { url: `/history-queries/${historyQuery.id}/edit`, expected: ['History', historyQuery.name, 'Edit'] },
    { url: `/history-queries/${historyQuery.id}/cache`, expected: ['History', historyQuery.name, 'Cache'] },
    { url: '/engine', expected: ['Engine'] },
    { url: '/engine/edit', expected: ['Engine', 'Edit engine settings'] },
    { url: '/engine/oianalytics', expected: ['Engine', 'OIAnalytics registration'] },
    { url: '/logs', expected: ['Logs'] },
    { url: '/about', expected: ['About'] },
    { url: '/user-settings', expected: ['Settings'] }
  ])('should show the breadcrumb of $url', async ({ url, expected }) => {
    await createAt(url);

    await expectBreadcrumbTexts(expected);
  });

  test('should load the entities displayed in the breadcrumb', async () => {
    await createAt(`/north/${north.id}`);
    await expectBreadcrumbTexts(['North', `${north.name} (console)`]);
    expect(northConnectorService.findById).toHaveBeenCalledWith(north.id);
    expect(northConnectorService.getNorthManifest).toHaveBeenCalledWith(north.type);

    await TestBed.inject(Router).navigateByUrl(`/south/${south.id}/workflows/workflow-1/history`);
    await expectBreadcrumbTexts(['South', `${south.name} (${south.type})`, 'Reactor discovery', 'Run history']);
    expect(southConnectorService.findById).toHaveBeenCalledWith(south.id);
    expect(configurationWorkflowService.get).toHaveBeenCalledWith(south.id, 'workflow-1');

    await TestBed.inject(Router).navigateByUrl(`/history-queries/${historyQuery.id}`);
    await expectBreadcrumbTexts(['History', historyQuery.name]);
    expect(historyQueryService.findById).toHaveBeenCalledWith(historyQuery.id);
  });

  test('should update breadcrumbs on navigation', async () => {
    await createAt('/north');
    await expectBreadcrumbTexts(['North']);

    await TestBed.inject(Router).navigateByUrl('/south/create');
    await expectBreadcrumbTexts(['South', 'Create']);

    await TestBed.inject(Router).navigateByUrl('/');
    await expect.element(tester.breadcrumbItems).toHaveLength(0);
  });

  test.each([
    {
      url: '/north/north-1',
      setup: () => northConnectorService.findById.mockReturnValue(throwError(() => new Error())),
      expected: ['North', 'north-1']
    },
    {
      url: '/south/south-1',
      setup: () => southConnectorService.findById.mockReturnValue(throwError(() => new Error())),
      expected: ['South', 'south-1']
    },
    {
      url: '/history-queries/history-1',
      setup: () => historyQueryService.findById.mockReturnValue(throwError(() => new Error())),
      expected: ['History', 'history-1']
    },
    {
      url: `/south/${south.id}/workflows/workflow-1/history`,
      setup: () => configurationWorkflowService.get.mockReturnValue(throwError(() => new Error())),
      expected: ['South', `${south.name} (${south.type})`, 'workflow-1', 'Run history']
    }
  ])('should display the id when an entity of $url cannot be loaded', async ({ url, setup, expected }) => {
    setup();
    await createAt(url);

    await expectBreadcrumbTexts(expected);
  });

  test('should make breadcrumb items clickable except the last one', async () => {
    await createAt(`/north/${north.id}`);

    await expectBreadcrumbTexts(['North', `${north.name} (console)`]);
    await expect.element(tester.breadcrumbLinks).toHaveLength(1);
    await expect.element(tester.breadcrumbLinks.nth(0)).toHaveTextContent('North');
    await expect.element(tester.breadcrumbLinks.nth(0)).toHaveAttribute('href', '/north');
  });

  test('should link the south connector name on the run history breadcrumb', async () => {
    await createAt(`/south/${south.id}/workflows/workflow-1/history`);

    await expect.element(tester.breadcrumbItems).toHaveLength(4);
    await expect.element(tester.breadcrumbLinks).toHaveLength(2);
    await expect.element(tester.breadcrumbLinks.nth(1)).toHaveTextContent(`${south.name} (${south.type})`);
    await expect.element(tester.breadcrumbLinks.nth(1)).toHaveAttribute('href', `/south/${south.id}`);
  });

  test('should link the breadcrumb to the list', async () => {
    await createAt('/north/create');

    await tester.breadcrumbLinks.nth(0).click();

    await expectBreadcrumbTexts(['North']);
    expect(TestBed.inject(Router).url).toBe('/north');
  });
});
