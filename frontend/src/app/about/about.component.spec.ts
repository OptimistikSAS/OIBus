import { TestBed } from '@angular/core/testing';

import { AboutComponent } from './about.component';
import { ComponentTester } from 'ngx-speculoos';

class AboutComponentTester extends ComponentTester<AboutComponent> {
  constructor() {
    super(AboutComponent);
  }
}
describe('AboutComponent', () => {
  let tester: AboutComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: []
    });

    tester = new AboutComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester).toBeTruthy();
  });
});
