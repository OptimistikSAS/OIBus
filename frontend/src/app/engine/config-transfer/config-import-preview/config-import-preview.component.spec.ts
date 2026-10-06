import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { of, throwError } from 'rxjs';

import { ConfigImportPreviewComponent } from './config-import-preview.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { ConfigImportPreviewDTO } from '@oibus/shared/config-transfer.model';
import { TransformerDTO } from '@oibus/shared/transformer.model';
import { TransformerService } from '../../../services/transformer.service';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';

const localStandardTransformer = (functionName: string) =>
  ({ id: `local-${functionName}`, type: 'standard', functionName, inputType: 'any', outputType: 'any' }) as TransformerDTO;

const audit = {
  oIBusCreatedBy: 'admin',
  oIBusUpdatedBy: 'admin',
  oIBusCreatedAt: '2026-01-01T00:00:00.000Z',
  oIBusUpdatedAt: '2026-01-01T00:00:00.000Z'
};

const items = Array.from({ length: 25 }, (_, index) => ({
  id: `item${index + 1}`,
  enabled: index !== 1,
  name: `Item ${index + 1}`,
  settings: { nodeId: `ns=1;s=Item${index + 1}` },
  scanModeId: 'scanMode1',
  scanModeName: 'every second',
  groupId: index === 0 ? 'group1' : null
}));

const preview = {
  fromVersion: '3.9.0',
  toVersion: '3.10.0',
  appliedUpgrades: [{ version: '3.10.0', description: 'an upgrade' }],
  config: {
    engine: {
      ...audit,
      oIBusInternalId: 'engine',
      settings: {
        general: { name: 'OIBus' },
        webServer: { port: 2224, authTokenDuration: '7d' },
        proxyServer: {
          enabled: true,
          port: 9000,
          username: 'proxy-user',
          password: 'should-never-be-displayed',
          forward: { enabled: true, url: 'http://forward:3128', username: 'forward-user', password: 'should-never-be-displayed' }
        },
        logger: {
          auditRetentionDuration: 90,
          console: { level: 'info' },
          file: { level: 'debug', maxFileSize: 50, numberOfFiles: 5 },
          database: { level: 'info', maxNumberOfLogs: 100_000 },
          loki: { level: 'silent', interval: 60, address: 'http://loki:3100', username: 'oibus', password: '' },
          oia: { level: 'silent', interval: 10 },
          syslog: { level: 'warn', host: 'syslog.example.com', port: 514, protocol: 'udp4' }
        }
      }
    },
    registration: {},
    scanModes: [
      {
        ...audit,
        oIBusInternalId: 'scanMode1',
        settings: { name: 'every second', description: 'fast', type: 'cron', cron: '* * * * * *', interval: null, activationWindow: null }
      }
    ],
    ipFilters: [{ ...audit, oIBusInternalId: 'ipFilter1', settings: { address: '192.168.1.1', description: 'local' } }],
    certificates: [],
    users: [
      {
        ...audit,
        oIBusInternalId: 'user1',
        settings: { login: 'jdoe', firstName: 'John', lastName: 'Doe', email: 'jdoe@example.com', language: 'en', timezone: 'Europe/Paris' }
      }
    ],
    transformers: [
      // listed by every export but linked to by nothing: never counted nor reported as missing
      {
        oIBusInternalId: 'unlinked-standard',
        type: 'standard',
        settings: { functionName: 'json-to-csv', inputType: 'any', outputType: 'any' },
        manifest: {}
      },
      {
        oIBusInternalId: 'standard1',
        type: 'standard',
        settings: { functionName: 'iso', inputType: 'any', outputType: 'any' },
        manifest: {}
      },
      {
        oIBusInternalId: 'custom1',
        type: 'custom',
        settings: {
          name: 'My transformer',
          description: '',
          inputType: 'time-values',
          outputType: 'any',
          language: 'javascript',
          timeout: 1000,
          customCode: 'return data;'
        },
        manifest: {}
      }
    ],
    southConnectors: [
      {
        ...audit,
        oIBusInternalId: 'south1',
        type: 'opcua',
        settings: {
          name: 'My OPCUA',
          type: 'opcua',
          description: 'line A',
          enabled: true,
          settings: { url: 'opc.tcp://localhost:4840' },
          items,
          groups: [{ id: 'group1', standardSettings: { name: 'Group 1', scanModeId: 'scanMode1' } }],
          configurationWorkflows: [
            {
              id: 'workflow1',
              name: 'Discover nodes',
              discoveryScope: {},
              identityKeyFields: ['nodeId'],
              eligibilityFilter: [],
              itemFieldMapping: null,
              pushToOIAnalytics: false,
              scanModeId: null,
              enabled: true
            }
          ]
        }
      }
    ],
    northConnectors: [
      {
        ...audit,
        oIBusInternalId: 'north1',
        type: 'console',
        settings: {
          name: 'My console',
          type: 'console',
          description: '',
          enabled: true,
          settings: { verbose: true },
          caching: {},
          transformers: [
            { id: 't1', source: { type: 'south', southId: 'south1', items: [] }, transformerId: 'custom1', options: { precision: 2 } },
            { id: 't2', source: { type: 'oianalytics-setpoint' }, transformerId: 'standard1', options: {} }
          ]
        }
      }
    ],
    historyQueries: [
      {
        ...audit,
        oIBusInternalId: 'history1',
        settings: {
          name: 'Backfill',
          description: '',
          queryTimeRange: { startTime: '2026-01-01T00:00:00.000Z', endTime: '2026-01-02T00:00:00.000Z', maxReadInterval: 0, readDelay: 0 },
          caching: {},
          southType: 'opcua',
          southSettings: {},
          northType: 'console',
          northSettings: {},
          items: [{ id: 'hItem1', name: 'History item', enabled: true, settings: {} }],
          northTransformers: [{ id: 'ht1', items: [], transformerId: 'standard1', options: {} }]
        }
      }
    ]
  }
} as unknown as ConfigImportPreviewDTO;

class ConfigImportPreviewComponentTester {
  readonly fixture = TestBed.createComponent(ConfigImportPreviewComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly element = this.fixture.nativeElement as HTMLElement;

  constructor() {
    this.fixture.componentRef.setInput('preview', preview);
    this.fixture.detectChanges();
  }

  toggle(key: string) {
    return this.root.getByCss(`[data-section="${key}"]`);
  }

  async open(...keys: Array<string>) {
    for (const key of keys) {
      await this.toggle(key).click();
      this.fixture.detectChanges();
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
    expect(tester.element.querySelector('.preview-content')).toBeNull();
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
    await expect.element(tester.toggle('south:south1')).toMatchTextContent('My OPCUA');
    await expect.element(tester.toggle('south:south1')).toMatchTextContent('OPC UA™');

    await tester.open('south:south1', 'south:south1:settings', 'south:south1:groups', 'south:south1:workflows');
    await expect.element(tester.root.getByText('opc.tcp://localhost:4840', { exact: false })).toBeInTheDocument();
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

    const items = () => tester.element.querySelectorAll('.preview-items .preview-toggle');
    expect(items().length).toBe(20);
    expect(items()[0].textContent).toContain('Item 1');
    expect(items()[0].textContent).toContain('active · every second · Group 1');
    expect(items()[1].textContent).toContain('paused · every second');
    expect(tester.element.querySelector('.preview-items .preview-json')).toBeNull();

    await tester.open('south:south1:item:item1');
    await expect.element(tester.root.getByText('ns=1;s=Item1"', { exact: false })).toBeInTheDocument();

    tester.componentInstance.changePage('south:south1:items', 1);
    tester.fixture.detectChanges();

    expect(items().length).toBe(5);
    expect(items()[0].textContent).toContain('Item 21');
  });

  test('should resolve the transformers and sources of a north connector, and show their options', async () => {
    createTester();
    await tester.open('north', 'north:north1', 'north:north1:transformers');

    await expect.element(tester.toggle('north:north1:transformer:0')).toMatchTextContent('My transformer');
    await expect.element(tester.toggle('north:north1:transformer:0')).toMatchTextContent('My OPCUA (OPC UA™) [All items]');
    await expect.element(tester.toggle('north:north1:transformer:1')).toMatchTextContent('No transform');
    await expect.element(tester.toggle('north:north1:transformer:1')).toMatchTextContent('OIAnalytics setpoints');

    await tester.open('north:north1:transformer:0');
    await expect.element(tester.root.getByText('"precision": 2', { exact: false })).toBeInTheDocument();
  });

  test('should display a history query and its sub sections', async () => {
    createTester();
    await tester.open('history');
    await expect.element(tester.toggle('history:history1')).toMatchTextContent('Backfill');
    await expect.element(tester.toggle('history:history1')).toMatchTextContent('OPC UA™ → Console');

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
    expect(tester.element.querySelector('[data-section="transformer:standard1"]')).toBeNull();
    await expect.element(tester.root.getByCss('#preview-standard-transformers')).toMatchTextContent('1 standard transformer(s) are used');
    expect(tester.element.querySelector('#preview-missing-standard-transformers')).toBeNull();
    await expect.element(tester.root.getByText('jdoe@example.com')).toBeInTheDocument();
  });

  test('should warn about standard transformers this instance does not have, and flag the links to them', async () => {
    transformerService.list.mockReturnValue(of([localStandardTransformer('ignore')]));
    createTester();

    await tester.open('transformers', 'north', 'north:north1', 'north:north1:transformers');
    await expect.element(tester.root.getByCss('#preview-missing-standard-transformers')).toMatchTextContent('No transform');
    expect(tester.element.querySelectorAll('#preview-missing-standard-transformers li').length).toBe(1);
    await expect.element(tester.toggle('north:north1:transformer:1')).toMatchTextContent('No transform (not available, will be skipped)');
    await expect.element(tester.toggle('north:north1:transformer:0')).not.toMatchTextContent('will be skipped');
  });

  test('should not warn about standard transformers when the local ones cannot be retrieved', async () => {
    transformerService.list.mockReturnValue(throwError(() => new Error('boom')));
    createTester();

    await tester.open('transformers');
    expect(tester.element.querySelector('#preview-missing-standard-transformers')).toBeNull();
  });

  test('should display the logging settings, each output collapsible', async () => {
    createTester();
    await tester.open('engine', 'engine:logging');

    const outputs = tester.element.querySelectorAll('.preview-logging .preview-toggle');
    expect(Array.from(outputs).map(output => output.textContent!.trim())).toEqual([
      'Console: Info',
      'File: Debug',
      'Database: Info',
      'Loki: Silent',
      'OIAnalytics: Silent',
      'Syslog: Warning'
    ]);
    await expect.element(tester.root.getByCss('#preview-audit-retention')).toMatchTextContent('90');

    await tester.open('logging:console', 'logging:file', 'logging:loki');
    await expect.element(tester.root.getByText('No additional settings.')).toBeInTheDocument();
    await expect.element(tester.root.getByText('"numberOfFiles": 5', { exact: false })).toBeInTheDocument();
    await expect.element(tester.root.getByText('http://loki:3100', { exact: false })).toBeInTheDocument();
    expect(tester.element.querySelector('.preview-logging')!.textContent).not.toContain('password');
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
    expect(tester.element.textContent).not.toContain('should-never-be-displayed');
  });
});
