import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { ComponentTester } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';

class HomeComponentTester extends ComponentTester<HomeComponent> {
  constructor() {
    super(HomeComponent);
  }

  get homeButtons() {
    return this.elements('.home-button');
  }
}

describe('HomeComponent', () => {
  let tester: HomeComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideTestingI18n(), provideRouter([])]
    });

    tester = new HomeComponentTester();
    tester.detectChanges();
  });

  it('should display engine home', () => {
    expect(tester.homeButtons.length).toBe(4);
    expect(tester.homeButtons[0]).toContainText('Engine');
  });

  it('should display history queries home', () => {
    expect(tester.homeButtons.length).toBe(4);
    expect(tester.homeButtons[2]).toContainText('History Queries');
  });

  it('should display North home', () => {
    expect(tester.homeButtons.length).toBe(4);
    expect(tester.homeButtons[1]).toContainText('North');
  });

  it('should display South home', () => {
    expect(tester.homeButtons.length).toBe(4);
    expect(tester.homeButtons[3]).toContainText('South');
  });
});
