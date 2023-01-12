import { TestBed } from '@angular/core/testing';

import { NorthListComponent } from './north-list.component';
import { ComponentTester } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';

class NorthListComponentTester extends ComponentTester<NorthListComponent> {
  constructor() {
    super(NorthListComponent);
  }

  get title() {
    return this.element('h1');
  }
}
describe('NorthListComponent', () => {
  let tester: NorthListComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [NorthListComponent],
      providers: [provideTestingI18n()]
    });

    tester = new NorthListComponentTester();
    tester.detectChanges();
  });

  it('should display title', () => {
    expect(tester.title).toContainText('North list');
  });
});
