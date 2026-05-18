import { TestBed } from '@angular/core/testing';
import { describe, expect, test } from 'vitest';

import { ProgressbarComponent } from './progressbar.component';

describe('ProgressbarComponent', () => {
  test('should create without error', () => {
    TestBed.configureTestingModule({});

    const fixture = TestBed.createComponent(ProgressbarComponent);
    fixture.componentRef.setInput('value', 50);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('animated', false);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
