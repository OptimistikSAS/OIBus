import { TestConnectionResultModalComponent } from './test-connection-result-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { SouthConnectorCommandDTO } from '../../../../../backend/shared/model/south-connector.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../../../backend/shared/model/north-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';
import testData from '../../../../../backend/src/tests/utils/test-data';

class TestConnectionResultModalComponentTester extends ComponentTester<TestConnectionResultModalComponent> {
  constructor() {
    super(TestConnectionResultModalComponent);
  }

  get spinner() {
    return this.element('#spinner');
  }

  get error() {
    return this.element('#connection-error');
  }

  get success() {
    return this.element('#success');
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('TestConnectionResultModalComponent', () => {
  let tester: TestConnectionResultModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

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
      southConnectorService.testConnection.and.returnValue(of(undefined));
    });

    it('should be loading', async () => {
      tester.componentInstance.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      await tester.change();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', async () => {
      tester.componentInstance.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      await tester.change();

      expect(southConnectorService.testConnection).toHaveBeenCalledWith(southConnector.id, southConnector.settings, southConnector.type);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without south', async () => {
      tester.componentInstance.runTest('south', null, southConnector.settings, southConnector.type);
      await tester.change();

      expect(southConnectorService.testConnection).toHaveBeenCalledWith('create', southConnector.settings, southConnector.type);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(async () => {
      southConnectorService.testConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runTest('south', southConnector.id, southConnector.settings, southConnector.type);

      await tester.change();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', async () => {
      tester.componentInstance.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
      await tester.change();
      tester.cancel.click();
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
      northConnectorService.testConnection.and.returnValue(of(undefined));
    });

    it('should be loading', async () => {
      tester.componentInstance.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
      await tester.change();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', async () => {
      tester.componentInstance.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
      await tester.change();

      expect(northConnectorService.testConnection).toHaveBeenCalledWith(northConnector.id, northConnector.settings, northConnector.type);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without north', async () => {
      tester.componentInstance.runTest('north', null, northConnector.settings, northConnector.type);
      await tester.change();

      expect(northConnectorService.testConnection).toHaveBeenCalledWith('create', northConnector.settings, northConnector.type);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(async () => {
      northConnectorService.testConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runTest('north', northConnector.id, northConnector.settings, northConnector.type);

      await tester.change();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', async () => {
      tester.componentInstance.runTest('north', northConnector.id, northConnector.settings, northConnector.type);
      await tester.change();
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('History query north', () => {
    const northCommand: NorthConnectorCommandDTO = {
      name: 'test',
      settings: {}
    } as NorthConnectorCommandDTO;

    beforeEach(() => {
      historyQueryService.testNorthConnection.and.returnValue(of(undefined));
    });

    it('should be loading', async () => {
      tester.componentInstance.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);
      await tester.change();
      expect(tester.spinner).toBeDefined();

      tester.componentInstance.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type, 'fromNorthId');
      await tester.change();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', async () => {
      tester.componentInstance.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);
      await tester.change();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('historyId', northCommand.settings, northCommand.type, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type, 'fromNorthId');
      await tester.change();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith(
        'historyId',
        northCommand.settings,
        northCommand.type,
        'fromNorthId'
      );
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without history id', async () => {
      tester.componentInstance.runHistoryQueryTest('north', null, northCommand.settings, northCommand.type);
      await tester.change();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('create', northCommand.settings, northCommand.type, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('north', null, northCommand.settings, northCommand.type, 'fromNorthId');
      await tester.change();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith(
        'create',
        northCommand.settings,
        northCommand.type,
        'fromNorthId'
      );
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(async () => {
      historyQueryService.testNorthConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);

      await tester.change();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', async () => {
      tester.componentInstance.runHistoryQueryTest('north', 'historyId', northCommand.settings, northCommand.type);
      await tester.change();
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('History query south', () => {
    const southCommand: SouthConnectorCommandDTO = {
      name: 'test',
      settings: {}
    } as SouthConnectorCommandDTO;

    beforeEach(() => {
      historyQueryService.testSouthConnection.and.returnValue(of(undefined));
    });

    it('should be loading', async () => {
      tester.componentInstance.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);
      await tester.change();
      expect(tester.spinner).toBeDefined();

      tester.componentInstance.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type, 'fromSouthId');
      await tester.change();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', async () => {
      tester.componentInstance.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);
      await tester.change();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('historyId', southCommand.settings, southCommand.type, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type, 'fromSouthId');
      await tester.change();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith(
        'historyId',
        southCommand.settings,
        southCommand.type,
        'fromSouthId'
      );
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without history id', async () => {
      tester.componentInstance.runHistoryQueryTest('south', null, southCommand.settings, southCommand.type);
      await tester.change();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('create', southCommand.settings, southCommand.type, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('south', null, southCommand.settings, southCommand.type, 'fromSouthId');
      await tester.change();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith(
        'create',
        southCommand.settings,
        southCommand.type,
        'fromSouthId'
      );
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(async () => {
      historyQueryService.testSouthConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);

      await tester.change();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', async () => {
      tester.componentInstance.runHistoryQueryTest('south', 'historyId', southCommand.settings, southCommand.type);
      await tester.change();
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
