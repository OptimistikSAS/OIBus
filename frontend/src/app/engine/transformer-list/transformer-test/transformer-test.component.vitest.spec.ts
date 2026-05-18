import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { TransformerTestComponent } from './transformer-test.component';
import { TransformerService } from '../../../services/transformer.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CustomTransformerCommandDTO } from '../../../../../../backend/shared/model/transformer.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const transformerCommand = testData.transformers.command as unknown as CustomTransformerCommandDTO;

describe('TransformerTestComponent', () => {
  let transformerService: MockObject<TransformerService>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'any', data: '', description: '' }));

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideHttpClientTesting(), { provide: TransformerService, useValue: transformerService }]
    });
  });

  test('should render without error', async () => {
    const fixture = TestBed.createComponent(TransformerTestComponent);
    fixture.componentRef.setInput('transformer', transformerCommand);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root).toBeInTheDocument();
  });
});
