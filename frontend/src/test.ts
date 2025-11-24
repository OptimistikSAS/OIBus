// This file is required by karma.conf.js and loads recursively all the .spec and framework files
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { speculoosMatchers } from 'ngx-speculoos';
import { NgModule, provideZoneChangeDetection } from '@angular/core';

beforeEach(() => {
  jasmine.addMatchers(speculoosMatchers);
  spyOn(console, 'warn').and.callThrough();
  spyOn(console, 'error').and.callThrough();
});

afterEach(() => {
  // eslint-disable-next-line no-console
  expect(console.warn).withContext('There should be no console warnings (see src/test.ts)').not.toHaveBeenCalled();
  // eslint-disable-next-line no-console
  expect(console.error).withContext('There should be no console errors (see src/test.ts)').not.toHaveBeenCalled();
});

// Since Angular v21, zoneless is the default, so we explicitly add provideZoneChangeDetection for our tests
@NgModule({
  providers: [provideZoneChangeDetection()]
})
export class ZoneTestModule {}

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment([BrowserTestingModule, ZoneTestModule], platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true
});
