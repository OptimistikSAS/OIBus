import { TestConnectionResultModalComponent } from './test-connection-result-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { HistoryQueryService } from '../../services/history-query.service';

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
    const southConnector: SouthConnectorDTO = {
      id: 'id1',
      type: 'SQL',
      name: 'My South Connector 1',
      description: 'My South connector description',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200,
        overlap: 0
      },
      settings: {}
    };

    const southCommand: SouthConnectorCommandDTO = {
      name: 'test',
      settings: {}
    } as SouthConnectorCommandDTO;

    beforeEach(() => {
      southConnectorService.testConnection.and.returnValue(of(undefined));
    });

    it('should be loading', () => {
      tester.componentInstance.runTest('south', southConnector, southCommand);
      tester.detectChanges();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', () => {
      tester.componentInstance.runTest('south', southConnector, southCommand);
      tester.detectChanges();

      expect(southConnectorService.testConnection).toHaveBeenCalledWith(southConnector.id, southCommand);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without south', () => {
      tester.componentInstance.runTest('south', null, southCommand);
      tester.detectChanges();

      expect(southConnectorService.testConnection).toHaveBeenCalledWith('create', southCommand);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(() => {
      southConnectorService.testConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runTest('south', southConnector, southCommand);

      tester.detectChanges();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', () => {
      tester.componentInstance.runTest('south', southConnector, southCommand);
      tester.detectChanges();
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('North type', () => {
    const northConnector: NorthConnectorDTO = {
      id: 'id1',
      type: 'SQL',
      name: 'My South Connector 1',
      description: 'My South connector description',
      enabled: true,
      settings: {}
    } as NorthConnectorDTO;

    const northCommand: NorthConnectorCommandDTO = {
      name: 'test',
      settings: {}
    } as NorthConnectorCommandDTO;

    beforeEach(() => {
      northConnectorService.testConnection.and.returnValue(of(undefined));
    });

    it('should be loading', () => {
      tester.componentInstance.runTest('north', northConnector, northCommand);
      tester.detectChanges();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', () => {
      tester.componentInstance.runTest('north', northConnector, northCommand);
      tester.detectChanges();

      expect(northConnectorService.testConnection).toHaveBeenCalledWith(northConnector.id, northCommand);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without north', () => {
      tester.componentInstance.runTest('north', null, northCommand);
      tester.detectChanges();

      expect(northConnectorService.testConnection).toHaveBeenCalledWith('create', northCommand);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(() => {
      northConnectorService.testConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runTest('north', northConnector, northCommand);

      tester.detectChanges();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', () => {
      tester.componentInstance.runTest('north', northConnector, northCommand);
      tester.detectChanges();
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

    it('should be loading', () => {
      tester.componentInstance.runHistoryQueryTest('north', northCommand, 'historyId');
      tester.detectChanges();
      expect(tester.spinner).toBeDefined();

      tester.componentInstance.runHistoryQueryTest('north', northCommand, 'historyId', 'fromNorthId');
      tester.detectChanges();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', () => {
      tester.componentInstance.runHistoryQueryTest('north', northCommand, 'historyId');
      tester.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('historyId', northCommand, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('north', northCommand, 'historyId', 'fromNorthId');
      tester.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('historyId', northCommand, 'fromNorthId');
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without history id', () => {
      tester.componentInstance.runHistoryQueryTest('north', northCommand, null);
      tester.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('create', northCommand, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('north', northCommand, null, 'fromNorthId');
      tester.detectChanges();

      expect(historyQueryService.testNorthConnection).toHaveBeenCalledWith('create', northCommand, 'fromNorthId');
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(() => {
      historyQueryService.testNorthConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runHistoryQueryTest('north', northCommand, 'historyId');

      tester.detectChanges();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', () => {
      tester.componentInstance.runHistoryQueryTest('north', northCommand, 'historyId');
      tester.detectChanges();
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

    it('should be loading', () => {
      tester.componentInstance.runHistoryQueryTest('south', southCommand, 'historyId');
      tester.detectChanges();
      expect(tester.spinner).toBeDefined();

      tester.componentInstance.runHistoryQueryTest('south', southCommand, 'historyId', 'fromSouthId');
      tester.detectChanges();
      expect(tester.spinner).toBeDefined();
    });

    it('should display success', () => {
      tester.componentInstance.runHistoryQueryTest('south', southCommand, 'historyId');
      tester.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('historyId', southCommand, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('south', southCommand, 'historyId', 'fromSouthId');
      tester.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('historyId', southCommand, 'fromSouthId');
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display success without history id', () => {
      tester.componentInstance.runHistoryQueryTest('south', southCommand, null);
      tester.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('create', southCommand, null);
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();

      tester.componentInstance.runHistoryQueryTest('south', southCommand, null, 'fromSouthId');
      tester.detectChanges();

      expect(historyQueryService.testSouthConnection).toHaveBeenCalledWith('create', southCommand, 'fromSouthId');
      expect(tester.success).toContainText('Connection successfully tested');
      expect(tester.spinner).toBeNull();
      expect(tester.error).toBeNull();
    });

    it('should display error', fakeAsync(() => {
      historyQueryService.testSouthConnection.and.returnValue(throwError(() => new HttpErrorResponse({ error: { message: 'failure' } })));
      tester.componentInstance.runHistoryQueryTest('south', southCommand, 'historyId');

      tester.detectChanges();
      expect(tester.error).toContainText('failure');
      expect(tester.spinner).toBeNull();
      expect(tester.success).toBeNull();
    }));

    it('should cancel', () => {
      tester.componentInstance.runHistoryQueryTest('south', southCommand, 'historyId');
      tester.detectChanges();
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
