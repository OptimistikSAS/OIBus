import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NavbarComponent } from './navbar/navbar.component';
import { provideTestingI18n } from '../i18n/mock-i18n';
import { WindowService } from './shared/window.service';
import { CurrentUserService } from './shared/current-user.service';
import { User } from '../../../shared/model/user.model';
import { of } from 'rxjs';

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

  let windowService: jasmine.SpyObj<WindowService>;
  let currentUserService: jasmine.SpyObj<CurrentUserService>;

  const currentUser = {
    login: 'admin',
    language: 'en',
    timezone: 'Asia/Tokyo'
  } as User;

  beforeEach(() => {
    windowService = createMock(WindowService);
    currentUserService = createMock(CurrentUserService);

    TestBed.configureTestingModule({
      imports: [AppComponent, NavbarComponent],
      providers: [
        provideRouter([]),
        provideTestingI18n(),
        { provide: WindowService, useValue: windowService },
        { provide: CurrentUserService, useValue: currentUserService }
      ]
    });

    currentUserService.get.and.returnValue(of(currentUser));
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
