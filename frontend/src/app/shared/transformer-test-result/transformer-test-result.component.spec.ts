import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing';
import { TransformerTestResultComponent } from './transformer-test-result.component';

class TransformerTestResultComponentTester {
  readonly fixture = TestBed.createComponent(TransformerTestResultComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly stages = this.root.getByCss('.pipeline-stage');
  readonly rawStage = this.stages.nth(0);
  readonly outputStage = this.root.getByCss('.pipeline-stage-output');
}

describe('TransformerTestResultComponent', () => {
  let tester: TransformerTestResultComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), provideCurrentUser()] });
    tester = new TransformerTestResultComponentTester();
  });

  test('should show only the raw stage when there is no transformer', async () => {
    tester.fixture.componentRef.setInput('raw', { type: 'any-content', content: 'raw content' });

    await expect.element(tester.stages).toHaveLength(1);
    await expect.element(tester.rawStage.getByCss('.oib-box-title')).toMatchTextContent(/^Raw result/);
    await expect.element(tester.rawStage).toMatchTextContent(/raw content/);
  });

  test('should show both the raw and output stages once a transformer is involved', async () => {
    tester.fixture.componentRef.setInput('raw', { type: 'any-content', content: 'raw content' });
    tester.fixture.componentRef.setInput('hasTransformer', true);
    tester.fixture.componentRef.setInput('output', { type: 'any-content', content: 'transformed content' });

    await expect.element(tester.stages).toHaveLength(2);
    await expect.element(tester.outputStage.getByCss('.oib-box-title')).toMatchTextContent(/^Transformer output/);
    await expect.element(tester.outputStage).toMatchTextContent(/transformed content/);
  });

  test('should switch the display mode of a stage', async () => {
    tester.fixture.componentRef.setInput('raw', {
      type: 'time-values',
      content: [{ pointId: 'point1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: '42' } }]
    });
    const modeToggle = tester.rawStage.getByRole('button', { name: 'Table view' });
    await expect.element(modeToggle).toBeVisible();

    await modeToggle.click();
    await tester.rawStage.getByRole('button', { name: 'JSON view' }).click();

    await expect.element(tester.rawStage.getByRole('button', { name: 'JSON view' })).toBeVisible();
    await expect.element(tester.rawStage).toMatchTextContent(/"pointId": "point1"/);
  });
});
