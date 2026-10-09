import { Route } from '@angular/router';

import { describe, expect, test } from 'vitest';

import { ROUTES } from './app.routes';

function flatten(routes: Array<Route>, parentPath = ''): Array<{ path: string; route: Route }> {
  return routes.flatMap(route => {
    const path = [parentPath, route.path].filter(Boolean).join('/');
    return [{ path, route }, ...flatten(route.children ?? [], path)];
  });
}

const lazyRoutes = flatten(ROUTES).filter(({ route }) => route.loadComponent);

describe('ROUTES', () => {
  test('should lazy-load a component for every page', () => {
    expect(lazyRoutes.length).toBeGreaterThan(20);
  });

  test.each(lazyRoutes)('should load the component of /$path', async ({ route }) => {
    const component = await route.loadComponent!();

    // compiled Angular components carry their definition in a static ɵcmp property
    expect(component).toHaveProperty('ɵcmp');
  });
});
