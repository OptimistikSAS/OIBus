import { TestBed } from '@angular/core/testing';

import { NavbarComponent } from './navbar.component';
import { provideRouter } from '@angular/router';
import { ComponentTester } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';

class NavbarComponentTester extends ComponentTester<NavbarComponent> {
  constructor() {
    super(NavbarComponent);
  }

  get navItems() {
    return this.elements('.nav-item');
  }
}
describe('NavbarComponent', () => {
  let tester: NavbarComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([]), provideTestingI18n()]
    });

    tester = new NavbarComponentTester();
  });

  it('should have a navbar with nav items', () => {
    tester.detectChanges();
    expect(tester.navItems.length).toBe(5);
    expect(tester.navItems[0]).toContainText('Engine');
    expect(tester.navItems[1]).toContainText('North');
    expect(tester.navItems[2]).toContainText('South');
    expect(tester.navItems[3]).toContainText('Logs');
    expect(tester.navItems[4]).toContainText('About');
  });
});
