import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { ComponentTester } from 'ngx-speculoos';
import { NavbarComponent } from './navbar/navbar.component';

class AppComponentTester extends ComponentTester<AppComponent> {
  constructor() {
    super(AppComponent);
  }

  get navbar() {
    return this.element('oib-navbar');
  }

  get routerOutlet() {
    return this.element('router-outlet');
  }
}
describe('AppComponent', () => {
  let tester: AppComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent, NavbarComponent],
      providers: [provideRouter([])]
    });

    tester = new AppComponentTester();
    tester.detectChanges();
  });

  it(`should have a navbar`, () => {
    expect(tester.navbar).not.toBeNull();
  });

  it(`should have a router outlet`, () => {
    expect(tester.routerOutlet).not.toBeNull();
  });
});
