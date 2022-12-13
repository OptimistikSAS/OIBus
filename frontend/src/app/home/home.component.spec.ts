import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { ComponentTester } from 'ngx-speculoos';

class HomeComponentTester extends ComponentTester<HomeComponent> {
  constructor() {
    super(HomeComponent);
  }

  get title() {
    return this.element('h1');
  }
}

describe('HomeComponent', () => {
  let tester: HomeComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideTestingI18n()]
    });

    tester = new HomeComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.title).toHaveText('Welcome to OiBus');
  });
});
