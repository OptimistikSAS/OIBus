import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test } from 'vitest';

import { TransformerTestResultComponent } from './transformer-test-result.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { OIBusContent } from '../../../../../backend/shared/model/engine.model';

describe('TransformerTestResultComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  function create() {
    const fixture = TestBed.createComponent(TransformerTestResultComponent);
    fixture.detectChanges();
    return fixture;
  }

  test('shows only the raw stage when there is no transformer', () => {
    const fixture = create();
    fixture.componentRef.setInput('raw', { type: 'time-values', content: [] } as OIBusContent);
    fixture.detectChanges();

    const stages = fixture.nativeElement.querySelectorAll('.pipeline-stage');
    expect(stages).toHaveLength(1);
  });

  test('shows both the raw and output stages side by side once a transformer is involved', () => {
    const fixture = create();
    fixture.componentRef.setInput('raw', { type: 'time-values', content: [] } as OIBusContent);
    fixture.componentRef.setInput('hasTransformer', true);
    fixture.componentRef.setInput('output', { type: 'any-content', content: 'out' } as OIBusContent);
    fixture.detectChanges();

    const stages = fixture.nativeElement.querySelectorAll('.pipeline-stage');
    expect(stages).toHaveLength(2);
  });
});
