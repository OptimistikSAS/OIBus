import { ErrorFilesComponent } from './error-files.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { Component, ViewChild } from '@angular/core';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  template: `<oib-error-files #component [northConnector]="northConnector" />`,
  standalone: true,
  imports: [ErrorFilesComponent]
})
class TestComponent {
  @ViewChild('component') component!: ErrorFilesComponent;
  northConnector: NorthConnectorDTO<NorthSettings> = {
    id: 'northId',
    name: 'North Connector'
  } as NorthConnectorDTO<NorthSettings>;
}

class ErrorFilesComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get fileErrors() {
    return this.elements('td');
  }
}

describe('ErrorFilesComponent', () => {
  let tester: ErrorFilesComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northConnectorService }]
    });

    tester = new ErrorFilesComponentTester();
    northConnectorService.getCacheErrorFiles.and.returnValue(of([]));
    northConnectorService.removeCacheErrorFiles.and.returnValue(of());
    northConnectorService.retryCacheErrorFiles.and.returnValue(of());
    northConnectorService.getCacheErrorFileContent.and.returnValue(of());
    tester.detectChanges();
  });

  it('should have no error files', () => {
    expect(tester.fileErrors.length).toBe(0);
  });

  it('should handle item actions', () => {
    const file = {
      filename: 'filename',
      modificationDate: '2021-01-01T00:00:00.000Z',
      size: 123
    };

    tester.componentInstance.component.onItemAction({ type: 'remove', file });
    expect(northConnectorService.removeCacheErrorFiles).toHaveBeenCalled();

    tester.componentInstance.component.onItemAction({ type: 'retry', file });
    expect(northConnectorService.retryCacheErrorFiles).toHaveBeenCalled();

    tester.componentInstance.component.onItemAction({ type: 'view', file });
    expect(northConnectorService.getCacheErrorFileContent).toHaveBeenCalled();
  });
});
