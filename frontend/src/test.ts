// This file is required by karma.conf.js and loads recursively all the .spec and framework files
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { speculoosMatchers } from 'ngx-speculoos';

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

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true
});
