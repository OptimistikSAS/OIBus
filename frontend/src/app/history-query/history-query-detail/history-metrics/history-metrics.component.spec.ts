import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, test } from 'vitest';

import { HistoryMetricsComponent } from './history-metrics.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { HistoryQueryDTO } from '../../../../../../backend/shared/model/history-query.model';
import { HistoryQueryMetrics } from '../../../../../../backend/shared/model/engine.model';
import { NorthConnectorManifest } from '../../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';

describe('HistoryMetricsComponent', () => {
  test('should create without error', () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    const fixture = TestBed.createComponent(HistoryMetricsComponent);
    fixture.componentRef.setInput('historyQuery', testData.historyQueries.list[0] as unknown as HistoryQueryDTO);
    fixture.componentRef.setInput('historyMetrics', testData.historyQueries.metrics as unknown as HistoryQueryMetrics);
    fixture.componentRef.setInput('northManifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.componentRef.setInput('southManifest', testData.south.manifest as unknown as SouthConnectorManifest);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  test('should display per-item progress and per-item status table', () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    const fixture = TestBed.createComponent(HistoryMetricsComponent);
    fixture.componentRef.setInput('historyQuery', testData.historyQueries.list[0] as unknown as HistoryQueryDTO);
    fixture.componentRef.setInput('historyMetrics', testData.historyQueries.metrics as unknown as HistoryQueryMetrics);
    fixture.componentRef.setInput('northManifest', testData.north.manifest as unknown as NorthConnectorManifest);
    fixture.componentRef.setInput('southManifest', testData.south.manifest as unknown as SouthConnectorManifest);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;

    // item progress bar row shows the current item name and X / N counter
    const bodyText = compiled.textContent ?? '';
    expect(bodyText).toContain('item1');
    expect(bodyText).toContain('1');
    expect(bodyText).toContain('3');

    // per-item status table renders one row per item in itemsStatus
    const itemRows = fixture.debugElement.queryAll(By.css('tr.history-item-status'));
    expect(itemRows.length).toBe(3);
    expect(itemRows[0].nativeElement.textContent).toContain('item1');
    expect(itemRows[1].nativeElement.textContent).toContain('item2');
    expect(itemRows[2].nativeElement.textContent).toContain('item3');
  });
});
