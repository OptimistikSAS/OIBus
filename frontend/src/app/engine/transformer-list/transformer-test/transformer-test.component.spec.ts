import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { InputTemplate } from '@oibus/shared/api/transformer.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { TransformerService } from '../../../services/transformer.service';
import { TransformerTestComponent } from './transformer-test.component';

describe('TransformerTestComponent', () => {
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '', description: '' } as InputTemplate));

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideHttpClientTesting(), { provide: TransformerService, useValue: transformerService }]
    });
  });

  test('should render without error', async () => {
    const fixture = TestBed.createComponent(TransformerTestComponent);
    fixture.componentRef.setInput('transformer', testData.transformers.command);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root).toBeInTheDocument();
  });
});
