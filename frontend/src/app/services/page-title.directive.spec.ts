import { PageTitleDirective } from './page-title.directive';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test } from 'vitest';

@Component({
  selector: 'oib-test',
  template: '<oib-page-title title="OIBus name" />',
  imports: [PageTitleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {}

describe('PageTitleDirective', () => {
  let titleService: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    titleService = TestBed.inject(Title);
    TestBed.createComponent(TestComponent).detectChanges();
  });

  test('should set the page title', () => {
    expect(titleService.getTitle()).toBe('OIBus - OIBus name');
  });
});
