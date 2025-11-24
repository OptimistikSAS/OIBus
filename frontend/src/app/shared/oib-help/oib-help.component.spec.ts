import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { OibHelpComponent } from './oib-help.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'test-oib-help-component',
  template: ` <oib-help [url]="url" />`,
  imports: [OibHelpComponent, TranslateModule]
})
class TestComponent {
  url = 'https://oibus.optimistik.com' as const;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get infoCircle() {
    return this.element('.fa-question-circle')!;
  }
}

describe('OibHelpComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponent, TranslateModule.forRoot()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should display a info circle', () => {
    expect(tester.infoCircle).toHaveText('');
  });
});
