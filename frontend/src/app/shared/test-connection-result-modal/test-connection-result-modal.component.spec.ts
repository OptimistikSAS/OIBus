import { TestConnectionResultModalComponent } from './test-connection-result-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { SouthConnectorCommandDTO } from '../../../../../backend/shared/model/south-connector.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

class TestConnectionResultModalComponentTester {
  readonly fixture = TestBed.createComponent(TestConnectionResultModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByCss('#spinner');
  readonly error = this.root.getByCss('#connection-error');
  readonly success = this.root.getByCss('#success');
  readonly cancel = this.root.getByRole('button', { name: 'Close' });
  readonly table = this.root.getByCss('table');
}

describe('TestConnectionResultModalComponent', () => {
  let tester: TestConnectionResultModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;

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

  describe('South type', () => {
    const southConnector = testData.south.list[0];

    beforeEach(() => {
      southConnectorService.testConnection.mockReturnValue(of({ items: [] }));
    });

    test('should be loading', async () => {
      southConnectorService.testConnection.mockReturnValue(NEVER);
      tester.component.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      tester.fixture.detectChanges();
      await expect.element(tester.spinner).toBeInTheDocument();
    });

    test('should display success', async () => {
      tester.component.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      tester.fixture.detectChanges();

      expect(southConnectorService.testConnection).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
      expect(tester.component.testResult).toEqual({ items: [] });
      await expect.element(tester.table).not.toBeInTheDocument();
    });

    test('should display success with result items', async () => {
      southConnectorService.testConnection.mockReturnValue(of({ items: [{ key: 'Version', value: '1.2.3' }] }));
      tester.component.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      tester.fixture.detectChanges();

      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      expect(tester.component.testResult).toEqual({ items: [{ key: 'Version', value: '1.2.3' }] });
      await expect.element(tester.table).toBeInTheDocument();
    });

    test('should display success without south', async () => {
      tester.component.runTest('south', null, southConnector.settings, southConnector.type);
      tester.fixture.detectChanges();

      expect(southConnectorService.testConnection).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display error', async () => {
      southConnectorService.testConnection.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.component.runTest('south', southConnector.id, southConnector.settings, southConnector.type);

      tester.fixture.detectChanges();
      await expect.element(tester.error).toHaveTextContent('failure');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.success).not.toBeInTheDocument();
    });

    test('should cancel', async () => {
      tester.component.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      tester.fixture.detectChanges();
      await tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('North type', () => {
    const northConnector: NorthConnectorDTO = {
      id: 'id1',
      type: 'file-writer',
      name: 'My South Connector 1',
      description: 'My South connector description',
      enabled: true,
      settings: {}
    } as NorthConnectorDTO;

    beforeEach(() => {
      northConnectorService.testConnection.mockReturnValue(of({ items: [] }));
    });

    test('should be loading', async () => {
      northConnectorService.testConnection.mockReturnValue(NEVER);
      tester.component.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
      tester.fixture.detectChanges();
      await expect.element(tester.spinner).toBeInTheDocument();
    });

    test('should display success', async () => {
      tester.component.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
      tester.fixture.detectChanges();

      expect(northConnectorService.testConnection).toHaveBeenCalledWith(northConnector.id, northConnector.settings, northConnector.type);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display success without north', async () => {
      tester.component.runTest('north', null, northConnector.settings, northConnector.type);
      tester.fixture.detectChanges();

      expect(northConnectorService.testConnection).toHaveBeenCalledWith('create', northConnector.settings, northConnector.type);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display error', async () => {
      northConnectorService.testConnection.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.component.runTest('north', northConnector.id, northConnector.settings, northConnector.type);

      tester.fixture.detectChanges();
      await expect.element(tester.error).toHaveTextContent('failure');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.success).not.toBeInTheDocument();
    });

    test('should cancel', async () => {
      tester.component.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
      tester.fixture.detectChanges();
      await tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('History query north', () => {
    const northCommand: NorthConnectorCommandDTO = {
      name: 'test',
      settings: {}
    } as NorthConnectorCommandDTO;

    beforeEach(() => {
      historyQueryService.testNorthConnection.mockReturnValue(of({ items: [] }));
    });

    test('should be loading', async () => {
      historyQueryService.testNorthConnection.mockReturnValue(NEVER);
      tester.component.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);
      tester.fixture.detectChanges();
      await expect.element(tester.spinner).toBeInTheDocument();

      tester.component.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type, 'fromNorthId');
      tester.fixture.detectChanges();
      await expect.element(tester.spinner).toBeInTheDocument();
    });

    test('should display success', async () => {
      tester.component.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);
      tester.fixture.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('historyId', northCommand.settings, northCommand.type, null);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();

      tester.component.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type, 'fromNorthId');
      tester.fixture.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith(
        'historyId',
        northCommand.settings,
        northCommand.type,
        'fromNorthId'
      );
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display success without history id', async () => {
      tester.component.runHistoryQueryTest('north', null, northCommand.settings, northCommand.type);
      tester.fixture.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('create', northCommand.settings, northCommand.type, null);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();

      tester.component.runHistoryQueryTest('north', null, northCommand.settings, northCommand.type, 'fromNorthId');
      tester.fixture.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith(
        'create',
        northCommand.settings,
        northCommand.type,
        'fromNorthId'
      );
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display error', async () => {
      historyQueryService.testNorthConnection.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.component.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);

      tester.fixture.detectChanges();
      await expect.element(tester.error).toHaveTextContent('failure');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.success).not.toBeInTheDocument();
    });

    test('should cancel', async () => {
      tester.component.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);
      tester.fixture.detectChanges();
      await tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('History query south', () => {
    const southCommand: SouthConnectorCommandDTO = {
      name: 'test',
      settings: {}
    } as SouthConnectorCommandDTO;

    beforeEach(() => {
      historyQueryService.testSouthConnection.mockReturnValue(of({ items: [] }));
    });

    test('should be loading', async () => {
      historyQueryService.testSouthConnection.mockReturnValue(NEVER);
      tester.component.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);
      tester.fixture.detectChanges();
      await expect.element(tester.spinner).toBeInTheDocument();

      tester.component.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type, 'fromSouthId');
      tester.fixture.detectChanges();
      await expect.element(tester.spinner).toBeInTheDocument();
    });

    test('should display success', async () => {
      tester.component.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);
      tester.fixture.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('historyId', southCommand.settings, southCommand.type, null);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();

      tester.component.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type, 'fromSouthId');
      tester.fixture.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith(
        'historyId',
        southCommand.settings,
        southCommand.type,
        'fromSouthId'
      );
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display success without history id', async () => {
      tester.component.runHistoryQueryTest('south', null, southCommand.settings, southCommand.type);
      tester.fixture.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('create', southCommand.settings, southCommand.type, null);
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();

      tester.component.runHistoryQueryTest('south', null, southCommand.settings, southCommand.type, 'fromSouthId');
      tester.fixture.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith(
        'create',
        southCommand.settings,
        southCommand.type,
        'fromSouthId'
      );
      await expect.element(tester.success).toHaveTextContent('Connection successfully tested');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.error).not.toBeInTheDocument();
    });

    test('should display error', async () => {
      historyQueryService.testSouthConnection.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.component.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);

      tester.fixture.detectChanges();
      await expect.element(tester.error).toHaveTextContent('failure');
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.success).not.toBeInTheDocument();
    });

    test('should cancel', async () => {
      tester.component.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);
      tester.fixture.detectChanges();
      await tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
