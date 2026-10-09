import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, Mock, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusConnectionTestResult } from '@oibus/shared/domain/engine.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { TestConnectionResultModalComponent } from './test-connection-result-modal.component';

class TestConnectionResultModalComponentTester {
  readonly fixture = TestBed.createComponent(TestConnectionResultModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly spinner = this.root.getByRole('status');
  readonly error = this.root.getByCss('#connection-error');
  readonly success = this.root.getByCss('#success');
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly resultRows = this.root.getByRole('row');
}

type TestConnectionMock = Mock<(...args: Array<never>) => Observable<OIBusConnectionTestResult>>;

interface TestCase {
  name: string;
  /** runs the test with the given id (null when creating) */
  run: (component: TestConnectionResultModalComponent, id: string | null) => void;
  /** the mocked service method called by the modal */
  serviceMethod: () => TestConnectionMock;
  /** the arguments the service method should be called with, for the given id */
  expectedArguments: (id: string) => Array<unknown>;
}

describe('TestConnectionResultModalComponent', () => {
  let tester: TestConnectionResultModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;
  const south = testData.south.list[0];
  const north = testData.north.list[0];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    northConnectorService = createMock(NorthConnectorService);
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });

    tester = new TestConnectionResultModalComponentTester();
  });

  const testCases: Array<TestCase> = [
    {
      name: 'south connector',
      run: (component, id) => component.runTest('south', id, south.settings, south.type),
      serviceMethod: () => southConnectorService.testConnection,
      expectedArguments: id => [id, south.settings, south.type]
    },
    {
      name: 'north connector',
      run: (component, id) => component.runTest('north', id, north.settings, north.type),
      serviceMethod: () => northConnectorService.testConnection,
      expectedArguments: id => [id, north.settings, north.type]
    },
    {
      name: 'history query south',
      run: (component, id) => component.runHistoryQueryTest('south', id, south.settings, south.type, 'southId1'),
      serviceMethod: () => historyQueryService.testSouthConnection,
      expectedArguments: id => [id, south.settings, south.type, 'southId1']
    },
    {
      name: 'history query north',
      run: (component, id) => component.runHistoryQueryTest('north', id, north.settings, north.type),
      serviceMethod: () => historyQueryService.testNorthConnection,
      expectedArguments: id => [id, north.settings, north.type, null]
    }
  ];

  describe.each(testCases)('$name', ({ run, serviceMethod, expectedArguments }) => {
    test('should be loading', async () => {
      serviceMethod().mockReturnValue(NEVER);

      run(tester.component, 'id1');

      await expect.element(tester.title).toHaveTextContent('Testing settings');
      await expect.element(tester.spinner).toBeInTheDocument();
      await expect.element(tester.success).not.toBeInTheDocument();
    });

    test('should display success', async () => {
      serviceMethod().mockReturnValue(of({ items: [] }));

      run(tester.component, 'id1');

      expect(serviceMethod()).toHaveBeenCalledWith(...expectedArguments('id1'));
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
      await expect.element(tester.resultRows).toHaveLength(0);
    });

    test('should display success with result items', async () => {
      serviceMethod().mockReturnValue(of({ items: [{ key: 'Version', value: '1.2.3' }] }));

      run(tester.component, 'id1');

      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.resultRows).toHaveLength(1);
      await expect.element(tester.resultRows.nth(0).getByRole('rowheader')).toHaveTextContent('Version');
      await expect.element(tester.resultRows.nth(0).getByRole('cell')).toHaveTextContent('1.2.3');
    });

    test('should test the settings of an entity being created', async () => {
      serviceMethod().mockReturnValue(of({ items: [] }));

      run(tester.component, null);

      expect(serviceMethod()).toHaveBeenCalledWith(...expectedArguments('create'));
      await expect.element(tester.success).toBeInTheDocument();
    });

    test('should display error', async () => {
      serviceMethod().mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));

      run(tester.component, 'id1');

      await expect.element(tester.error).toMatchTextContent(/^Error when testing settings\s*failure$/);
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.success).not.toBeInTheDocument();
    });
  });

  test('should cancel', async () => {
    southConnectorService.testConnection.mockReturnValue(NEVER);
    tester.component.runTest('south', south.id, south.settings, south.type);

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
