import { TestBed } from '@angular/core/testing';

import { AboutComponent } from './about.component';
import { ComponentTester } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';

class AboutComponentTester extends ComponentTester<AboutComponent> {
  constructor() {
    super(AboutComponent);
  }

  get officialSite() {
    return this.element('#official-site');
  }

  get version() {
    return this.element('#version');
  }

  get license() {
    return this.element('#license');
  }
}
describe('AboutComponent', () => {
  let tester: AboutComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [provideTestingI18n()]
    });

    tester = new AboutComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.officialSite).toContainText('Official site');
    expect(tester.license).toContainText('License');
    expect(tester.version).toContainText('Version');
  });
});
