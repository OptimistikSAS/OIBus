import { TestBed } from '@angular/core/testing';

import { NavbarComponent } from './navbar.component';
import { provideRouter } from '@angular/router';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { CurrentUserService } from '../shared/current-user.service';
import { of } from 'rxjs';
import { User } from '../../../../shared/model/user.model';
import { EngineService } from '../services/engine.service';
import { OIBusInfo } from '../../../../shared/model/engine.model';

class NavbarComponentTester extends ComponentTester<NavbarComponent> {
  constructor() {
    super(NavbarComponent);
  }

  get navItems() {
    return this.elements('.nav-item');
  }

  get version() {
    return this.element('#navbar-version');
  }
}
describe('NavbarComponent', () => {
  let tester: NavbarComponentTester;

  let currentUserService: jasmine.SpyObj<CurrentUserService>;
  let engineService: jasmine.SpyObj<EngineService>;

  const currentUser = {
    login: 'admin',
    language: 'en',
    timezone: 'Asia/Tokyo'
  } as User;

  beforeEach(() => {
    currentUserService = createMock(CurrentUserService);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        provideTestingI18n(),
        { provide: CurrentUserService, useValue: currentUserService },
        { provide: EngineService, useValue: engineService }
      ]
    });

    currentUserService.get.and.returnValue(of(currentUser));
    engineService.getInfo.and.returnValue(of({ version: '3.0' } as OIBusInfo));

    tester = new NavbarComponentTester();
  });

  it('should not display menu items when there is no user', () => {
    currentUserService.get.and.returnValue(of(null));

    tester.detectChanges();

    expect(tester.navItems.length).toBe(0);
  });

  it('should have a navbar with nav items', () => {
    tester.detectChanges();
    expect(tester.navItems.length).toBe(9);
    expect(tester.navItems[0]).toContainText('Engine');
    expect(tester.navItems[1]).toContainText('North');
    expect(tester.navItems[2]).toContainText('South');
    expect(tester.navItems[3]).toContainText('History');
    expect(tester.navItems[4]).toContainText('Logs');
    expect(tester.navItems[5]).toContainText('About');
  });

  it('should display version when it is available and there is a user', () => {
    tester.detectChanges();

    expect(tester.version).toContainText('Version: 3.0');
  });

  it('should logout and navigate to login page', () => {
    tester.detectChanges();

    tester.componentInstance.logout();
    expect(currentUserService.logout).toHaveBeenCalled();
  });
});
