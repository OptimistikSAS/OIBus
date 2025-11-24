import { TestBed } from '@angular/core/testing';

import { NorthTransformersComponent } from './north-transformers.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthConnectorService } from '../../services/north-connector.service';
import { Component, inject } from '@angular/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../backend/shared/model/transformer.model';
import { FormControl, NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'oib-test-north-transformers-component',
  template: `<oib-north-transformers [northManifest]="northManifest" [transformers]="transformers" [certificates]="[]" [scanModes]="[]" />`,
  imports: [NorthTransformersComponent]
})
class TestComponent {
  private fb = inject(NonNullableFormBuilder);

  control: FormControl<Array<TransformerDTOWithOptions>> = this.fb.control([]);
  transformers: Array<TransformerDTO> = [];
  northManifest: NorthConnectorManifest = { id: 'console', types: ['any', 'time-values'] } as NorthConnectorManifest;
}

class NorthTransformersComponentTester extends ComponentTester<TestComponent> {
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

describe('NorthTransformersComponent', () => {
  let tester: NorthTransformersComponentTester;
  let northService: jasmine.SpyObj<NorthConnectorService>;

  beforeEach(() => {
    northService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NorthConnectorService, useValue: northService }]
    });

    tester = new NorthTransformersComponentTester();
  });

  it('should display forms with types', async () => {
    await tester.change();
    expect(tester.transformers.length).toEqual(0);
  });
});
