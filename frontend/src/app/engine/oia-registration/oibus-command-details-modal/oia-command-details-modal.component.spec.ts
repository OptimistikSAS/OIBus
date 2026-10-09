import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

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

  test('should close the modal', async () => {
    const tester = new OiaCommandDetailsModalComponentTester(commandOfType('restart-engine'));

    await tester.closeButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
