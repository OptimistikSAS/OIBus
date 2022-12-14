import { TestBed } from '@angular/core/testing';

import { SouthListComponent } from './south-list.component';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { ComponentTester } from 'ngx-speculoos';

class SouthListComponentTester extends ComponentTester<SouthListComponent> {
  constructor() {
    super(SouthListComponent);
  }

  get title() {
    return this.element('h1');
  }
}
describe('SouthListComponent', () => {
  let tester: SouthListComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SouthListComponent],
      providers: [provideTestingI18n()]
    });

    tester = new SouthListComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.title).toContainText('South list');
  });
});
