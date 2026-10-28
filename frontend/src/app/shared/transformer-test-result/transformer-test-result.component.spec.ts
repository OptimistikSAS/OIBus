import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideCurrentUser } from '../current-user-testing';
import { PipelineActionsDirective, TransformerTestResultComponent } from './transformer-test-result.component';

@Component({
  selector: 'oib-test-transformer-test-result-actions',
  template: `
    <oib-transformer-test-result [raw]="raw" [hasTransformer]="hasTransformer()">
      <button type="button" oibPipelineActions id="action">Action</button>
    </oib-transformer-test-result>
  `,
  imports: [TransformerTestResultComponent, PipelineActionsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class ActionsTestComponent {
  readonly raw = { type: 'file', content: 'raw content' } as const;
  readonly hasTransformer = signal(false);
}

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
    tester.fixture.componentRef.setInput('raw', { type: 'file', content: 'raw content' });

    await expect.element(tester.stages).toHaveLength(1);
    await expect.element(tester.rawStage.getByCss('.pipeline-caption')).toMatchTextContent(/^Raw result/);
    await expect.element(tester.rawStage).toMatchTextContent(/raw content/);
  });

  test('should show both the raw and output stages once a transformer is involved', async () => {
    tester.fixture.componentRef.setInput('raw', { type: 'file', content: 'raw content' });
    tester.fixture.componentRef.setInput('hasTransformer', true);
    tester.fixture.componentRef.setInput('output', { type: 'file', content: 'transformed content' });

    await expect.element(tester.stages).toHaveLength(2);
    await expect.element(tester.outputStage.getByCss('.pipeline-caption')).toMatchTextContent(/^Transformer output/);
    await expect.element(tester.outputStage).toMatchTextContent(/transformed content/);
  });

  test('should show one of the stages on the full width', async () => {
    tester.fixture.componentRef.setInput('raw', { type: 'file', content: 'raw content' });
    tester.fixture.componentRef.setInput('hasTransformer', true);
    tester.fixture.componentRef.setInput('output', { type: 'file', content: 'transformed content' });
    const panes = tester.root.getByRole('group', { name: 'Show' });
    await expect.element(panes.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');

    await panes.getByRole('button', { name: 'Transformer output' }).click();
    await expect.element(tester.rawStage).not.toBeVisible();
    await expect.element(tester.outputStage).toBeVisible();

    await panes.getByRole('button', { name: 'Raw result' }).click();
    await expect.element(tester.rawStage).toBeVisible();
    await expect.element(tester.outputStage).not.toBeVisible();

    await panes.getByRole('button', { name: 'Both' }).click();
    await expect.element(tester.rawStage).toBeVisible();
    await expect.element(tester.outputStage).toBeVisible();
  });

  test('should not offer to choose the stages without transformer', async () => {
    tester.fixture.componentRef.setInput('raw', { type: 'file', content: 'raw content' });

    await expect.element(tester.root.getByRole('group', { name: 'Show' })).not.toBeInTheDocument();
  });

  test('should switch the display mode of a stage', async () => {
    tester.fixture.componentRef.setInput('raw', {
      type: 'record-list',
      content: [{ pointId: 'point1', timestamp: '2024-01-01T00:00:00.000Z', value: '42' }]
    });
    const modeToggle = tester.rawStage.getByRole('button', { name: 'Table view' });
    await expect.element(modeToggle).toBeVisible();

    await modeToggle.click();
    await tester.rawStage.getByRole('button', { name: 'JSON view' }).click();

    await expect.element(tester.rawStage.getByRole('button', { name: 'JSON view' })).toBeVisible();
    await expect.element(tester.rawStage).toMatchTextContent(/"pointId": "point1"/);
  });

  test('should show the actions given by the parent next to the choice of the stages, or alone without transformer', async () => {
    const fixture = TestBed.createComponent(ActionsTestComponent);
    const root = page.elementLocator(fixture.nativeElement);
    const panes = root.getByRole('group', { name: 'Show' });

    await expect.element(root.getByCss('.pipeline-actions').getByRole('button', { name: 'Action' })).toBeVisible();
    await expect.element(panes).not.toBeInTheDocument();

    fixture.componentInstance.hasTransformer.set(true);
    await expect.element(panes).toBeVisible();
    await expect.element(root.getByRole('button', { name: 'Action' })).toBeVisible();
  });

  test('should show no row of actions without transformer nor actions', async () => {
    tester.fixture.componentRef.setInput('raw', { type: 'file', content: 'raw content' });

    await expect.element(tester.rawStage).toBeVisible();
    await expect.element(tester.root.getByCss('.pipeline-actions')).not.toBeInTheDocument();
  });
});
