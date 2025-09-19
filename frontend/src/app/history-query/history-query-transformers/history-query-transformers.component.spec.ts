import { TestBed } from '@angular/core/testing';

import { HistoryQueryTransformersComponent } from './history-query-transformers.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { Component, inject } from '@angular/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { FormControl, NonNullableFormBuilder } from '@angular/forms';
import { HistoryQueryService } from '../../services/history-query.service';

@Component({
  template: `<oib-history-query-transformers
    [northManifest]="northManifest"
    [transformers]="transformers"
    [certificates]="[]"
    [scanModes]="[]"
  />`,
  imports: [HistoryQueryTransformersComponent]
})
class TestComponent {
  private fb = inject(NonNullableFormBuilder);

  control: FormControl<Array<TransformerDTOWithOptions>> = this.fb.control([]);
  transformers: Array<TransformerDTO> = [];
  northManifest: NorthConnectorManifest = { id: 'console', types: ['any', 'time-values'] } as NorthConnectorManifest;
}

class HistoryQueryTransformersComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get transformers() {
    return this.elements('tbody tr');
  }
}

describe('HistoryQueryTransformersComponent', () => {
  let tester: HistoryQueryTransformersComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: HistoryQueryService, useValue: historyQueryService }]
    });

    tester = new HistoryQueryTransformersComponentTester();
  });

  it('should display forms with types', () => {
    tester.detectChanges();
    expect(tester.transformers.length).toEqual(0);
  });
});
