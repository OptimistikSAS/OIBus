import { PageTitleDirective } from './page-title.directive';
import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';

@Component({
  selector: 'oib-test',
  template: '<oib-page-title title="OIBus name" />',
  standalone: true,
  imports: [PageTitleDirective]
})
class TestComponent {}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }
}

describe('PageTitleDirective', () => {
  let titleService: Title;
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    titleService = TestBed.inject(Title);
    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should set the page title', () => {
    expect(titleService.getTitle()).toBe('OIBus - OIBus name');
  });
});
