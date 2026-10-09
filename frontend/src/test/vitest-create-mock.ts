import { Type } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Params } from '@angular/router';

import { of } from 'rxjs';
import { MockedFunction, vi } from 'vitest';

function collectMethodNames(proto: unknown): Array<string> {
  if (!proto || proto === Object.prototype) {
    return [];
  }
  const methodNames: Array<string> = [];
  for (const key of Object.getOwnPropertyNames(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    if (descriptor && typeof descriptor.value === 'function' && key !== 'constructor') {
      methodNames.push(key);
    }
  }
  return [...methodNames, ...collectMethodNames(Object.getPrototypeOf(proto))];
}

// stolen from vitest's own code (not exported by vitest; `any` is required for any function to be assignable to it)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Procedure = (...args: Array<any>) => any;
type Methods<T> = keyof { [K in keyof T as T[K] extends Procedure ? K : never]: T[K] };
// inspired by vitest's MockedObject<T>
export type MockObject<T> = T & { [K in Methods<T>]: T[K] extends Procedure ? MockedFunction<T[K]> : T[K] };

/**
 * Creates a mock object for a class where all the methods of the class (and of its superclasses) are mocks.
 * @param type the type to mock (usually a service class)
 * @param overrides values for non-method members (e.g. an observable field such as `info$`), or method implementations
 */
export function createMock<T>(type: Type<T>, overrides: Partial<T> = {}): MockObject<T> {
  const fakeObject: Record<string, unknown> = {};
  for (const method of collectMethodNames(type.prototype)) {
    // The type name starts with _, so we slice it off for better readability in the mock names if there is one
    const typeName = type.name.startsWith('_') ? type.name.slice(1) : type.name;
    const mockName = `${typeName}.${method}`;
    fakeObject[method] = vi.fn().mockName(mockName);
  }
  return Object.assign(fakeObject, overrides) as MockObject<T>;
}
/**
 * Options for creating a stub ActivatedRoute.
 */
interface StubRouteOptions {
  params?: Params;
  queryParams?: Params;
}

/**
 * Creates a stub of ActivatedRoute for testing.
 *
 * @param options An object to configure the stubbed route's observables and snapshot.
 * @returns A partial mock of ActivatedRoute.
 */
export function stubRoute(options: StubRouteOptions = {}): Partial<ActivatedRoute> {
  const params = options.params ?? {};
  const queryParams = options.queryParams ?? {};

  return {
    params: of(params),
    queryParams: of(queryParams),
    paramMap: of(convertToParamMap(params)),
    queryParamMap: of(convertToParamMap(queryParams)),
    snapshot: {
      params,
      queryParams,
      paramMap: convertToParamMap(params),
      queryParamMap: convertToParamMap(queryParams)
    }
  } as Partial<ActivatedRoute>;
}
