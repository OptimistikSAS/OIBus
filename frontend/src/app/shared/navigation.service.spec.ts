import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { EmptyRouteComponent } from '../../test/empty-route.component';
import { BackNavigationDirective } from './back-navigation.directives';
import { NavigationService } from './navigation.service';

@Component({
  template: `<button type="button" oibBackButton>Back</button>`,
  imports: [BackNavigationDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {}

describe('NavigationService', () => {
  let service: NavigationService;
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: EmptyRouteComponent },
          { path: 'south', component: EmptyRouteComponent },
          { path: 'north', component: EmptyRouteComponent }
        ])
      ]
    });
    service = TestBed.inject(NavigationService);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    service.init();
  });

  test('should go back in the history when there is a previous page', async () => {
    await router.navigateByUrl('/south');
    await router.navigateByUrl('/north');
    vi.spyOn(location, 'back');

    service.back();

    expect(location.back).toHaveBeenCalled();
  });

  test('should go to the home page when there is no previous page', async () => {
    await router.navigateByUrl('/south');
    vi.spyOn(location, 'back');

    service.back();

    expect(location.back).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(router.url).toBe('/'));
  });

  test('should forget the pages it went back from', async () => {
    await router.navigateByUrl('/south');
    await router.navigateByUrl('/north');
    vi.spyOn(location, 'back').mockImplementation(() => {});

    service.back();
    service.back();

    expect(location.back).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(router.url).toBe('/'));
  });

  test('should go back when a back button is clicked', async () => {
    vi.spyOn(service, 'back');
    const fixture = TestBed.createComponent(TestComponent);

    await page.elementLocator(fixture.nativeElement).getByRole('button', { name: 'Back' }).click();

    expect(service.back).toHaveBeenCalled();
  });
});
