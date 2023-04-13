import { TestBed } from '@angular/core/testing';

import { SubNavbarComponent } from './sub-navbar.component';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ComponentTester, stubRoute } from 'ngx-speculoos';

class NavbarComponentTester extends ComponentTester<SubNavbarComponent> {
  constructor() {
    super(SubNavbarComponent);
  }

  get navItems() {
    return this.elements('.nav-item');
  }

  get backButton() {
    return this.element('#north-display');
  }
}
describe('NavbarComponent', () => {
  let tester: NavbarComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SubNavbarComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              northId: 'id1'
            }
          })
        }
      ]
    });

    tester = new NavbarComponentTester();
  });

  it('should logout and navigate to login page', () => {
    tester.detectChanges();

    expect(tester.backButton).toBeDefined();
  });
});
