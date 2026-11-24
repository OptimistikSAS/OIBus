import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusConnectionTestResult } from '@oibus/shared/domain/engine.model';
import { ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { provideCurrentUser } from '../current-user-testing';
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
  readonly notTrusted = this.root.getByCss('#server-not-trusted');
  readonly trustedBadge = this.root.getByCss('#server-trusted');
  readonly trustElsewhere = this.root.getByCss('#server-trust-elsewhere');
  readonly compare = this.root.getByText(/^Compare the fingerprint below/);
  readonly fingerprint = this.root.getByCss('#server-identity-fingerprint');
  readonly previousFingerprint = this.root.getByCss('#server-identity-previous-fingerprint');
  readonly trustButton = this.root.getByRole('button', { name: 'Trust this identity' });
}

const { sshHostKey: identity, otherSshHostKey: previousIdentity } = testData.serverTrust.identities;

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
        provideCurrentUser(),
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

  describe('identity of the server', () => {
    test('should display the identity trusted', async () => {
      southConnectorService.testConnection.mockReturnValue(
        of({ items: [{ key: 'Version', value: '1.2.3' }], serverIdentity: { identity, status: 'trusted' } })
      );

      tester.component.runTest('south', south.id, south.settings, south.type);

      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.notTrusted).not.toBeInTheDocument();
      await expect.element(tester.fingerprint).toHaveTextContent(identity.fingerprint);
      await expect.element(tester.trustedBadge).toHaveTextContent('Trusted identity');
      await expect.element(tester.trustButton).not.toBeInTheDocument();
      await expect.element(tester.trustElsewhere).not.toBeInTheDocument();
    });

    test('should trust an unknown identity, then test the connection again', async () => {
      const trust = vi.fn((_identity: ServerIdentity) => of(undefined));
      tester.component.allowServerTrust({ trusted: null, trust });
      southConnectorService.testConnection
        .mockReturnValueOnce(of({ items: [], serverIdentity: { identity, status: 'unknown' } }))
        .mockReturnValueOnce(of({ items: [], serverIdentity: { identity, status: 'trusted' } }));

      tester.component.runTest('south', south.id, south.settings, south.type);

      await expect.element(tester.notTrusted).toHaveClass('alert-warning');
      await expect
        .element(tester.notTrusted)
        .toHaveTextContent(
          'The connector does not trust any identity for this server yet: it refuses to connect to it until its identity is trusted.' +
            'The connection was not tested further: no credential is sent to a server whose identity is not trusted.'
        );
      await expect.element(tester.success).not.toBeInTheDocument();
      await expect.element(tester.fingerprint).toHaveTextContent(identity.fingerprint);
      await expect.element(tester.previousFingerprint).not.toBeInTheDocument();
      await expect.element(tester.compare).toBeInTheDocument();
      await expect.element(tester.trustElsewhere).not.toBeInTheDocument();

      await tester.trustButton.click();

      expect(trust).toHaveBeenCalledWith(identity);
      expect(southConnectorService.testConnection).toHaveBeenCalledTimes(2);
      expect(southConnectorService.testConnection).toHaveBeenLastCalledWith(south.id, south.settings, south.type);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.trustedBadge).toBeInTheDocument();
      await expect.element(tester.notTrusted).not.toBeInTheDocument();
      await expect.element(tester.previousFingerprint).not.toBeInTheDocument();
      await expect.element(tester.trustButton).not.toBeInTheDocument();
    });

    test('should show the identity trusted before a changed one', async () => {
      tester.component.allowServerTrust({ trusted: previousIdentity, trust: () => of(undefined) });
      historyQueryService.testNorthConnection.mockReturnValue(of({ items: [], serverIdentity: { identity, status: 'changed' } }));

      tester.component.runHistoryQueryTest('north', 'historyId1', north.settings, north.type);

      await expect.element(tester.notTrusted).toHaveClass('alert-danger');
      await expect.element(tester.notTrusted.getByText(/^The server presents another identity than the one trusted/)).toBeInTheDocument();
      await expect.element(tester.fingerprint).toHaveTextContent(identity.fingerprint);
      await expect.element(tester.previousFingerprint).toHaveTextContent(previousIdentity.fingerprint);
      await expect.element(tester.trustButton).toBeInTheDocument();
    });

    test('should not trust the identity twice while trusting it, and display why it could not be trusted', async () => {
      const trusted = new Subject<void>();
      const trust = vi.fn(() => trusted);
      tester.component.allowServerTrust({ trusted: null, trust });
      southConnectorService.testConnection.mockReturnValue(of({ items: [], serverIdentity: { identity, status: 'unknown' } }));
      tester.component.runTest('south', south.id, south.settings, south.type);

      await tester.trustButton.click();

      await expect.element(tester.trustButton).toBeDisabled();
      expect(southConnectorService.testConnection).toHaveBeenCalledTimes(1);

      trusted.error(new HttpErrorResponse({ error: { message: 'The server presents another certificate' } }));

      await expect.element(tester.error).toMatchTextContent(/^Error when testing settings\s*The server presents another certificate$/);
      // the identity refused is not offered anymore: the user tests again
      await expect.element(tester.trustButton).not.toBeInTheDocument();
      expect(southConnectorService.testConnection).toHaveBeenCalledTimes(1);
    });

    test('should display the error of the test run again once trusted', async () => {
      tester.component.allowServerTrust({ trusted: null, trust: () => of(undefined) });
      southConnectorService.testConnection
        .mockReturnValueOnce(of({ items: [], serverIdentity: { identity, status: 'unknown' } }))
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ error: { message: 'bad credentials' } })));
      tester.component.runTest('south', south.id, south.settings, south.type);

      await tester.trustButton.click();

      await expect.element(tester.error).toMatchTextContent(/^Error when testing settings\s*bad credentials$/);
      await expect.element(tester.notTrusted).not.toBeInTheDocument();
      await expect.element(tester.fingerprint).not.toBeInTheDocument();
      await expect.element(tester.trustButton).not.toBeInTheDocument();
    });

    test('should tell to trust the identity elsewhere when it cannot be trusted from the modal', async () => {
      northConnectorService.testConnection.mockReturnValue(of({ items: [], serverIdentity: { identity, status: 'unknown' } }));

      tester.component.runTest('north', north.id, north.settings, north.type);

      await expect.element(tester.notTrusted).toBeInTheDocument();
      await expect.element(tester.fingerprint).toHaveTextContent(identity.fingerprint);
      await expect.element(tester.trustElsewhere).toHaveTextContent('Trust this identity from the page of the connector.');
      await expect.element(tester.compare).not.toBeInTheDocument();
      await expect.element(tester.trustButton).not.toBeInTheDocument();
    });
  });

  test('should cancel', async () => {
    southConnectorService.testConnection.mockReturnValue(NEVER);
    tester.component.runTest('south', south.id, south.settings, south.type);

    await tester.cancel.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
