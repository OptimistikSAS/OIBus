import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CacheContentUpdateCommand, CacheSearchParam } from '@oibus/shared/domain/engine.model';
import { SouthConnectorItemTestingSettings } from '@oibus/shared/domain/south-connector.model';
import { OIBusCommandDTO, OIBusCommandType } from '@oibus/shared/oia/command.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { OiaCommandDetailsModalComponent } from './oia-command-details-modal.component';

class OiaCommandDetailsModalComponentTester {
  readonly fixture = TestBed.createComponent(OiaCommandDetailsModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly info = this.root.getByRole('heading', { level: 5 });
  readonly result = this.root.getByCss('.command-result');
  readonly contentLines = this.root.getByCss('.command-content li');
  readonly json = this.root.getByCss('.command-json');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });

  constructor(command: OIBusCommandDTO) {
    this.fixture.componentInstance.prepare(command);
  }
}

function commandOfType<T extends OIBusCommandType>(type: T): Extract<OIBusCommandDTO, { type: T }> {
  const command = testData.oIAnalytics.commands.oIBusList.find(
    (element): element is Extract<OIBusCommandDTO, { type: T }> => element.type === type
  )!;
  return { ...command, status: 'COMPLETED' };
}

const base = commandOfType('restart-engine');
const cacheSearch: CacheSearchParam = { start: undefined, end: undefined, nameContains: 'file', maxNumberOfFilesReturned: 10 };
const cacheUpdate: CacheContentUpdateCommand = {
  cache: { remove: ['file1'], move: [] },
  error: { remove: [], move: [{ filename: 'file2', to: 'cache' }] },
  archive: { remove: [], move: [] }
};
const testingSettings: SouthConnectorItemTestingSettings = { history: undefined };

describe('OiaCommandDetailsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should display a completed command', async () => {
    const tester = new OiaCommandDetailsModalComponentTester(commandOfType('restart-engine'));

    await expect.element(tester.title).toHaveTextContent('Command Restart');
    await expect.element(tester.info).toHaveTextContent('Command completed successfully');
    await expect.element(tester.result).toHaveTextContent('ok');
    // only the retrieved date
    await expect.element(tester.contentLines).toHaveLength(1);
    await expect.element(tester.contentLines.nth(0)).toMatchTextContent(/^Retrieved date: .*2020/);
  });

  test('should display an errored command', async () => {
    const tester = new OiaCommandDetailsModalComponentTester({ ...commandOfType('restart-engine'), status: 'ERRORED', result: 'failure' });

    await expect.element(tester.info).toHaveTextContent('Command failed');
    await expect.element(tester.result).toHaveTextContent('failure');
  });

  test('should display a version update', async () => {
    const tester = new OiaCommandDetailsModalComponentTester(commandOfType('update-version'));

    await expect.element(tester.contentLines).toHaveLength(5);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('Update to version: v3.5.0-beta');
    await expect.element(tester.contentLines.nth(2)).toMatchTextContent(/^Asset to download: /);
    await expect.element(tester.contentLines.nth(3)).toMatchTextContent(/^Update launcher: (Yes|No)$/);
    await expect.element(tester.contentLines.nth(4)).toMatchTextContent(/^Backup folders according to this pattern: /);
  });

  test.each<[OIBusCommandType, RegExp]>([
    ['update-scan-mode', /^Scan mode ID: scanModeId1$/],
    ['delete-scan-mode', /^Scan mode ID: scanModeId1$/],
    ['update-south', /^South connector ID: southId1$/],
    ['delete-south', /^South connector ID: southId1$/],
    ['update-north', /^North connector ID: northId1$/],
    ['delete-north', /^North connector ID: northId1$/]
  ])('should display the target of a %s command', async (type, expected) => {
    const tester = new OiaCommandDetailsModalComponentTester(commandOfType(type));

    await expect.element(tester.contentLines.nth(1)).toMatchTextContent(expected);
  });

  test.each<OIBusCommandType>([
    'update-engine-general',
    'update-registration-settings',
    'create-scan-mode',
    'update-scan-mode',
    'create-south',
    'update-south',
    'create-north',
    'update-north'
  ])('should display the JSON content of a %s command', async type => {
    const command = commandOfType(type);
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.json).toBeInTheDocument();
    expect(JSON.parse(tester.json.element().textContent!)).toEqual('commandContent' in command ? command.commandContent : null);
  });

  test('should display a south items import', async () => {
    const tester = new OiaCommandDetailsModalComponentTester({
      ...commandOfType('create-or-update-south-items-from-csv'),
      commandContent: { deleteItemsNotPresent: true, csvContent: 'name;value', delimiter: ';' }
    });

    await expect.element(tester.contentLines).toHaveLength(5);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('South connector ID: southId1');
    await expect.element(tester.contentLines.nth(2)).toHaveTextContent('Delete items not present: true');
    await expect.element(tester.contentLines.nth(3)).toHaveTextContent('Delimiter: ;');
    await expect.element(tester.contentLines.nth(4)).toHaveTextContent('CSV content: name;value');
  });

  test('should display a configuration import', async () => {
    const tester = new OiaCommandDetailsModalComponentTester({
      ...commandOfType('restart-engine'),
      type: 'import-configuration',
      commandContent: { fileId: 'fileId1' }
    });

    await expect.element(tester.title).toHaveTextContent('Command Import configuration');
    await expect.element(tester.contentLines).toHaveLength(2);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('Configuration file: fileId1');
  });

  test.each<OIBusCommandDTO>([
    { ...base, type: 'create-ip-filter', commandContent: testData.ipFilters.command },
    { ...base, type: 'create-certificate', commandContent: testData.certificates.command },
    { ...base, type: 'create-custom-transformer', commandContent: testData.transformers.command },
    {
      ...base,
      type: 'test-custom-transformer',
      commandContent: { command: testData.transformers.command, testRequest: { inputData: '{}' } }
    }
  ])('should display the JSON content of a $type command', async command => {
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.contentLines).toHaveLength(2);
    await expect.element(tester.contentLines.nth(1)).toMatchTextContent(/^JSON content/);
    expect(JSON.parse(tester.json.element().textContent!)).toEqual('commandContent' in command ? command.commandContent : null);
  });

  test.each<{ command: OIBusCommandDTO; expected: string }>([
    { command: { ...base, type: 'delete-ip-filter', ipFilterId: 'ipFilterId1' }, expected: 'IP filter ID: ipFilterId1' },
    { command: { ...base, type: 'delete-certificate', certificateId: 'certificateId1' }, expected: 'Certificate ID: certificateId1' },
    { command: { ...base, type: 'delete-history-query', historyQueryId: 'historyId1' }, expected: 'History query ID: historyId1' },
    { command: { ...base, type: 'delete-custom-transformer', transformerId: 'transformerId1' }, expected: 'Transformer ID: transformerId1' }
  ])('should display the target of a $command.type command', async ({ command, expected }) => {
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.contentLines).toHaveLength(2);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent(expected);
    await expect.element(tester.json).not.toBeInTheDocument();
  });

  test.each<OIBusCommandDTO>([
    { ...base, type: 'test-north-connection', northConnectorId: 'northId1', commandContent: testData.north.command },
    { ...base, type: 'setpoint', northConnectorId: 'northId1', commandContent: [{ reference: 'reference1', value: '100' }] },
    { ...base, type: 'search-north-cache-content', northConnectorId: 'northId1', commandContent: cacheSearch },
    {
      ...base,
      type: 'get-north-cache-file-content',
      northConnectorId: 'northId1',
      commandContent: { folder: 'cache', filename: 'file1' }
    },
    { ...base, type: 'update-north-cache-content', northConnectorId: 'northId1', commandContent: cacheUpdate }
  ])('should display the north connector and the content of a $type command', async command => {
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.contentLines).toHaveLength(3);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('North connector ID: northId1');
    expect(JSON.parse(tester.json.element().textContent!)).toEqual('commandContent' in command ? command.commandContent : null);
  });

  test.each<OIBusCommandDTO>([
    {
      ...base,
      type: 'update-history-query',
      historyQueryId: 'historyId1',
      commandContent: { resetCache: true, historyQuery: testData.historyQueries.command }
    },
    { ...base, type: 'search-history-cache-content', historyQueryId: 'historyId1', commandContent: cacheSearch },
    {
      ...base,
      type: 'get-history-cache-file-content',
      historyQueryId: 'historyId1',
      commandContent: { folder: 'error', filename: 'file1' }
    },
    { ...base, type: 'update-history-cache-content', historyQueryId: 'historyId1', commandContent: cacheUpdate }
  ])('should display the history query and the content of a $type command', async command => {
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.contentLines).toHaveLength(3);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('History query ID: historyId1');
    expect(JSON.parse(tester.json.element().textContent!)).toEqual('commandContent' in command ? command.commandContent : null);
  });

  test('should display a history query status update', async () => {
    const tester = new OiaCommandDetailsModalComponentTester({
      ...base,
      type: 'update-history-query-status',
      historyQueryId: 'historyId1',
      commandContent: { historyQueryStatus: 'RUNNING' }
    });

    await expect.element(tester.contentLines).toHaveLength(3);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('History query ID: historyId1');
    await expect.element(tester.contentLines.nth(2)).toHaveTextContent('History query status: RUNNING');
  });

  test('should display a history query items import', async () => {
    const tester = new OiaCommandDetailsModalComponentTester({
      ...base,
      type: 'create-or-update-history-query-south-items-from-csv',
      historyQueryId: 'historyId1',
      commandContent: { deleteItemsNotPresent: false, csvContent: 'name;value', delimiter: ';' }
    });

    await expect.element(tester.contentLines).toHaveLength(5);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent('History query ID: historyId1');
    await expect.element(tester.contentLines.nth(2)).toHaveTextContent('Delete items not present: false');
    await expect.element(tester.contentLines.nth(3)).toHaveTextContent('Delimiter: ;');
    await expect.element(tester.contentLines.nth(4)).toHaveTextContent('CSV content: name;value');
  });

  test.each<{ command: OIBusCommandDTO; expected: string }>([
    {
      command: { ...base, type: 'update-ip-filter', ipFilterId: 'ipFilterId1', commandContent: testData.ipFilters.command },
      expected: 'IP filter ID: ipFilterId1'
    },
    {
      command: { ...base, type: 'update-certificate', certificateId: 'certificateId1', commandContent: testData.certificates.command },
      expected: 'Certificate ID: certificateId1'
    },
    {
      command: {
        ...base,
        type: 'update-custom-transformer',
        transformerId: 'transformerId1',
        commandContent: testData.transformers.command
      },
      expected: 'Transformer ID: transformerId1'
    },
    {
      command: { ...base, type: 'test-transformer', transformerId: 'transformerId1', commandContent: { inputData: '{}' } },
      expected: 'Transformer ID: transformerId1'
    },
    {
      command: { ...base, type: 'test-south-connection', southConnectorId: 'southId1', commandContent: testData.south.command },
      expected: 'South connector ID: southId1'
    }
  ])('should display the target and the content of a $command.type command', async ({ command, expected }) => {
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.contentLines).toHaveLength(3);
    await expect.element(tester.contentLines.nth(1)).toHaveTextContent(expected);
    expect(JSON.parse(tester.json.element().textContent!)).toEqual('commandContent' in command ? command.commandContent : null);
  });

  test.each<{ command: OIBusCommandDTO; expected: Array<string> }>([
    {
      command: {
        ...base,
        type: 'test-south-item',
        southConnectorId: 'southId1',
        itemId: 'itemId1',
        commandContent: { southCommand: testData.south.command, itemCommand: testData.south.itemCommand, testingSettings }
      },
      expected: ['South connector ID: southId1', 'Item ID: itemId1']
    },
    {
      command: {
        ...base,
        type: 'create-history-query',
        southConnectorId: 'southId1',
        northConnectorId: 'northId1',
        historyQueryId: 'historyId1',
        commandContent: testData.historyQueries.command
      },
      expected: ['South connector ID: southId1', 'North connector ID: northId1', 'History query ID: historyId1']
    },
    {
      command: {
        ...base,
        type: 'create-history-query',
        southConnectorId: undefined,
        northConnectorId: undefined,
        historyQueryId: undefined,
        commandContent: testData.historyQueries.command
      },
      expected: []
    },
    {
      command: {
        ...base,
        type: 'test-history-query-north-connection',
        historyQueryId: 'historyId1',
        northConnectorId: 'northId1',
        commandContent: testData.historyQueries.command
      },
      expected: ['History query ID: historyId1', 'North connector ID: northId1']
    },
    {
      command: {
        ...base,
        type: 'test-history-query-south-connection',
        historyQueryId: 'historyId1',
        southConnectorId: undefined,
        commandContent: testData.historyQueries.command
      },
      expected: ['History query ID: historyId1']
    },
    {
      command: {
        ...base,
        type: 'test-history-query-south-item',
        historyQueryId: 'historyId1',
        southConnectorId: 'southId1',
        itemId: 'itemId1',
        commandContent: {
          historyCommand: testData.historyQueries.command,
          itemCommand: testData.historyQueries.itemCommand,
          testingSettings
        }
      },
      expected: ['History query ID: historyId1', 'South connector ID: southId1', 'Item ID: itemId1']
    }
  ])('should display the targets and the content of a $command.type command', async ({ command, expected }) => {
    const tester = new OiaCommandDetailsModalComponentTester(command);

    await expect.element(tester.contentLines).toHaveLength(expected.length + 2);
    for (const [index, line] of expected.entries()) {
      await expect.element(tester.contentLines.nth(index + 1)).toHaveTextContent(line);
    }
    expect(JSON.parse(tester.json.element().textContent!)).toEqual('commandContent' in command ? command.commandContent : null);
  });

  test('should close the modal', async () => {
    const tester = new OiaCommandDetailsModalComponentTester(commandOfType('restart-engine'));

    await tester.closeButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
