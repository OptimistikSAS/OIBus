import { TestBed } from '@angular/core/testing';

import { NorthTransformersComponent } from './north-transformers.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NorthConnectorService } from '../../services/north-connector.service';
import { Component, inject } from '@angular/core';
import { NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { TransformerLightDTO } from '../../../../../backend/shared/model/transformer.model';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';

@Component({
  template: `<oib-north-transformers [northManifest]="northManifest" [transformers]="transformers" [controls]="controls" />`,
  imports: [NorthTransformersComponent]
})
class TestComponent {
  private fb = inject(NonNullableFormBuilder);

  controls: FormGroup<{
    unknown: FormGroup<{ transformer: FormControl<TransformerLightDTO | null>; options: FormControl<object> }>;
    timeValues: FormGroup<{ transformer: FormControl<TransformerLightDTO | null>; options: FormControl<object> }>;
  }> = this.fb.group<{
    unknown: FormGroup<{ transformer: FormControl<TransformerLightDTO | null>; options: FormControl<object> }>;
    timeValues: FormGroup<{ transformer: FormControl<TransformerLightDTO | null>; options: FormControl<object> }>;
  }>({
    unknown: this.fb.group({
      transformer: this.fb.control(null as TransformerLightDTO | null),
      options: this.fb.control({})
    }),
    timeValues: this.fb.group({
      transformer: this.fb.control(null as TransformerLightDTO | null),
      options: this.fb.control({})
    })
  });
  transformers: Array<TransformerLightDTO> = [];
  northManifest: NorthConnectorManifest = { id: 'console', types: ['raw', 'time-values'] } as NorthConnectorManifest;
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

  it('should display forms with types', () => {
    tester.detectChanges();
    expect(tester.transformers.length).toEqual(2);
  });
});
