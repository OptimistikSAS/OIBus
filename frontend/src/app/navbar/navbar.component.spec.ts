import { TestBed } from '@angular/core/testing';

import { NavbarComponent } from './navbar.component';
import { provideRouter } from '@angular/router';
import { ComponentTester } from 'ngx-speculoos';

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
      providers: [provideRouter([])]
    });

    tester = new NavbarComponentTester();
  });

  it('should have a navbar with nav items', () => {
    tester.detectChanges();
    expect(tester.navItems.length).toBe(2);
    expect(tester.navItems[0]).toContainText('Logs');
    expect(tester.navItems[1]).toContainText('About');
  });
});
