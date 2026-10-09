import { TestBed } from '@angular/core/testing';

import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { StandardTransformerDTO } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { TransformerService } from '../../../services/transformer.service';
import { configImportPreview } from '../config-transfer-testing';
import { ConfigImportPreviewComponent } from './config-import-preview.component';

const localStandardTransformer = (functionName: string): StandardTransformerDTO => ({
  id: `local-${functionName}`,
  type: 'standard',
  functionName,
  inputType: 'any',
  outputType: 'any',
  manifest: testData.transformers.command.customManifest
});

class ConfigImportPreviewComponentTester {
  readonly fixture = TestBed.createComponent(ConfigImportPreviewComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly sectionContents = this.root.getByCss('.preview-content');
  readonly items = this.root.getByCss('.preview-items .preview-toggle');
  readonly loggingOutputs = this.root.getByCss('.preview-logging .preview-toggle');
  readonly missingStandardTransformers = this.root.getByCss('#preview-missing-standard-transformers');

  constructor() {
    this.fixture.componentRef.setInput('preview', configImportPreview);
  }

  toggle(key: string) {
    return this.root.getByCss(`[data-section="${key}"]`);
  }

  async open(...keys: Array<string>) {
    for (const key of keys) {
      await this.toggle(key).click();
    }
  }
}

describe('ConfigImportPreviewComponent', () => {
  let tester: ConfigImportPreviewComponentTester;
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    transformerService.list.mockReturnValue(of([localStandardTransformer('iso')]));
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), { provide: TransformerService, useValue: transformerService }] });
  });

  const createTester = () => {
    tester = new ConfigImportPreviewComponentTester();
  };

  test('should display every section with its count, collapsed', async () => {
    createTester();
    await expect.element(tester.root.getByCss('#preview-versions')).toMatchTextContent('3.9.0');
    await expect.element(tester.root.getByCss('#preview-upgrades-list')).toMatchTextContent('3.10.0: an upgrade');

    const counts: Record<string, string> = {
      south: '1',
      north: '1',
      history: '1',
      'scan-modes': '1',
      'ip-filters': '1',
      certificates: '0',
      transformers: '1',
      users: '1'
    };
    for (const [key, count] of Object.entries(counts)) {
      await expect.element(tester.toggle(key)).toHaveAttribute('aria-expanded', 'false');
      await expect.element(tester.toggle(key).getByCss('.preview-count')).toHaveTextContent(count);
    }
    await expect.element(tester.sectionContents).not.toBeInTheDocument();
    await expect.element(tester.toggle('engine')).toHaveAttribute('aria-expanded', 'false');
  });

  test('should expand and collapse a section', async () => {
    createTester();
    await tester.open('ip-filters');
    await expect.element(tester.toggle('ip-filters')).toHaveAttribute('aria-expanded', 'true');
    await expect.element(tester.root.getByText('192.168.1.1')).toBeInTheDocument();

    await tester.open('ip-filters');
    await expect.element(tester.root.getByText('192.168.1.1')).not.toBeInTheDocument();
  });

  test('should display a south connector and its sub sections', async () => {
    createTester();
    await tester.open('south');
    await expect.element(tester.toggle('south:south1')).toMatchTextContent('My folder scanner');
    await expect.element(tester.toggle('south:south1')).toMatchTextContent('Folder scanner');

    await tester.open('south:south1', 'south:south1:settings', 'south:south1:groups', 'south:south1:workflows');
    await expect.element(tester.root.getByText('/data/input', { exact: false })).toBeInTheDocument();
    await expect.element(tester.toggle('south:south1:items').getByCss('.preview-count')).toHaveTextContent('25');
    await expect.element(tester.root.getByText('Group 1')).toBeInTheDocument();
    await expect.element(tester.toggle('south:south1:workflow:0')).toMatchTextContent('Discover nodes');

    await expect.element(tester.toggle('south:south1:group:group1')).toMatchTextContent('every second');
    await tester.open('south:south1:group:group1', 'south:south1:workflow:0');
    await expect.element(tester.root.getByText('"scanModeId": "scanMode1"', { exact: false })).toBeInTheDocument();
    await expect.element(tester.root.getByText('"identityKeyFields"', { exact: false })).toBeInTheDocument();
  });

  test('should paginate the items of a south connector, each one collapsible', async () => {
    createTester();
    await tester.open('south', 'south:south1', 'south:south1:items');

    await expect.element(tester.items).toHaveLength(20);
    await expect.element(tester.items.nth(0)).toMatchTextContent('Item 1');
    await expect.element(tester.items.nth(0)).toMatchTextContent('active · every second · Group 1');
    await expect.element(tester.items.nth(1)).toMatchTextContent('paused · every second');
    await expect.element(tester.root.getByCss('.preview-items .preview-json')).not.toBeInTheDocument();

    await tester.open('south:south1:item:item1');
    await expect.element(tester.root.getByText('item1.csv"', { exact: false })).toBeInTheDocument();

    await tester.root.getByCss('oib-pagination').getByRole('link', { name: '2' }).click();

    await expect.element(tester.items).toHaveLength(5);
    await expect.element(tester.items.nth(0)).toMatchTextContent('Item 21');
  });

  test('should resolve the transformers and sources of a north connector, and show their options', async () => {
    createTester();
    await tester.open('north', 'north:north1', 'north:north1:transformers');

    await expect.element(tester.toggle('north:north1:transformer:0')).toMatchTextContent('My transformer');
    await expect.element(tester.toggle('north:north1:transformer:0')).toMatchTextContent('My folder scanner (Folder scanner) [All items]');
    await expect.element(tester.toggle('north:north1:transformer:1')).toMatchTextContent('No transform');
    await expect.element(tester.toggle('north:north1:transformer:1')).toMatchTextContent('OIAnalytics setpoints');

    await tester.open('north:north1:transformer:0');
    await expect.element(tester.root.getByText('"precision": 2', { exact: false })).toBeInTheDocument();
  });

  test('should display a history query and its sub sections', async () => {
    createTester();
    await tester.open('history');
    await expect.element(tester.toggle('history:history1')).toMatchTextContent('Backfill');
    await expect.element(tester.toggle('history:history1')).toMatchTextContent('Microsoft SQL Server™ → File writer');

    await tester.open('history:history1', 'history:history1:items', 'history:history1:transformers', 'history:history1:time-range');
    await expect.element(tester.toggle('history:history1:item:hItem1')).toMatchTextContent('History item');
    await expect.element(tester.toggle('history:history1:item:hItem1')).toMatchTextContent('active');
    await expect.element(tester.toggle('history:history1:transformer:0')).toMatchTextContent('No transform');
    await expect.element(tester.toggle('history:history1:transformer:0')).toMatchTextContent('All items');
    await expect.element(tester.root.getByText('2026-01-02T00:00:00.000Z', { exact: false })).toBeInTheDocument();
  });

  test('should only list custom transformers, standard ones being matched by name', async () => {
    createTester();
    await tester.open('transformers', 'users');
    await expect.element(tester.toggle('transformer:custom1')).toMatchTextContent('My transformer');
    await expect.element(tester.toggle('transformer:custom1')).toMatchTextContent('time-values → any');
    await expect.element(tester.toggle('transformer:standard1')).not.toBeInTheDocument();
    await expect.element(tester.root.getByCss('#preview-standard-transformers')).toMatchTextContent('1 standard transformer(s) are used');
    await expect.element(tester.missingStandardTransformers).not.toBeInTheDocument();
    await expect.element(tester.root.getByText('jdoe@example.com')).toBeInTheDocument();
  });

  test('should warn about standard transformers this instance does not have, and flag the links to them', async () => {
    transformerService.list.mockReturnValue(of([localStandardTransformer('ignore')]));
    createTester();

    await tester.open('transformers', 'north', 'north:north1', 'north:north1:transformers');
    await expect.element(tester.missingStandardTransformers).toMatchTextContent('No transform');
    await expect.element(tester.missingStandardTransformers.getByRole('listitem')).toHaveLength(1);
    await expect.element(tester.toggle('north:north1:transformer:1')).toMatchTextContent('No transform (not available, will be skipped)');
    await expect.element(tester.toggle('north:north1:transformer:0')).not.toMatchTextContent('will be skipped');
  });

  test('should not warn about standard transformers when the local ones cannot be retrieved', async () => {
    transformerService.list.mockReturnValue(throwError(() => new Error('boom')));
    createTester();

    await tester.open('transformers');
    await expect.element(tester.missingStandardTransformers).not.toBeInTheDocument();
  });

  test('should display the logging settings, each output collapsible', async () => {
    createTester();
    await tester.open('engine', 'engine:logging');

    const expectedOutputs = ['Console: Info', 'File: Debug', 'Database: Info', 'Loki: Silent', 'OIAnalytics: Silent', 'Syslog: Warning'];
    await expect.element(tester.loggingOutputs).toHaveLength(expectedOutputs.length);
    for (const [index, output] of expectedOutputs.entries()) {
      await expect.element(tester.loggingOutputs.nth(index)).toHaveTextContent(output);
    }
    await expect.element(tester.root.getByCss('#preview-audit-retention')).toMatchTextContent('90');

    await tester.open('logging:console', 'logging:file', 'logging:loki');
    await expect.element(tester.root.getByText('No additional settings.')).toBeInTheDocument();
    await expect.element(tester.root.getByText('"numberOfFiles": 5', { exact: false })).toBeInTheDocument();
    await expect.element(tester.root.getByText('http://loki:3100', { exact: false })).toBeInTheDocument();
    await expect.element(tester.root.getByCss('.preview-logging')).not.toMatchTextContent('password');
  });

  test('should display the engine general, web server and proxy server settings, without passwords', async () => {
    createTester();
    await tester.open('engine');
    await expect.element(tester.toggle('engine:general')).toMatchTextContent('OIBus');
    await expect.element(tester.toggle('engine:web-server')).toMatchTextContent('Port 2224');
    await expect.element(tester.toggle('engine:proxy-server')).toMatchTextContent('Enabled');

    await tester.open('engine:web-server', 'engine:proxy-server');
    await expect.element(tester.root.getByText('"authTokenDuration": "7d"', { exact: false })).toBeInTheDocument();
    await expect.element(tester.root.getByText('http://forward:3128', { exact: false })).toBeInTheDocument();
    await expect.element(tester.root).not.toMatchTextContent('should-never-be-displayed');
  });
});
