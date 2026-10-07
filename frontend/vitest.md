# Frontend testing guide

The frontend is tested with [Vitest](https://vitest.dev) in **browser mode**: every spec runs in a real Chromium (driven by
Playwright) and interacts with the DOM through Vitest's [locators](https://vitest.dev/guide/browser/locators).
Specs are run by the Angular `@angular/build:unit-test` builder (`ng test`), configured in `angular.json` and
`vitest-base.config.ts`.

## Running the tests

```bash
# Once: install the browser
npx playwright install chromium

# All the specs, with coverage (watch mode outside of CI)
npm test

# A single run, no watch
npx ng test --watch=false

# Only some specs
npx ng test --watch=false --include src/app/engine/engine-detail.component.spec.ts
```

The coverage report is written to `coverage/frontend` (open `index.html`). Test helpers (`test-utils.ts`, `*-testing.ts`,
`*.testing.ts`) are excluded from it.

Configuration worth knowing (`vitest-base.config.ts`):

- `restoreMocks: true`: spies created with `vi.spyOn` are restored after each test, no need to call `mockRestore()`.
- `testTimeout` / `hookTimeout` are 5 s.
- `resolve.tsconfigPaths`: lets Vite resolve the `@oibus/shared/*` alias (used when collecting coverage).
- `browser.viewport` is a desktop size (1280×800): some elements (e.g. the list search forms, `d-none d-lg-block`) are
  hidden on small screens.

## Test helpers

| Helper                                                      | Location                                                                | Purpose                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `getByCss(selector)`                                        | `src/test/test.ts`                                                      | Locator extension to query by CSS selector                      |
| `fillWithDate(date, h, m, s)` / `toHaveDisplayedDate(text)` | `src/test/test.ts`                                                      | Fill / assert an `oib-datetimepicker`                           |
| `createMock(Type)` / `MockObject<T>`                        | `src/test/vitest-create-mock.ts`                                        | Mock where every method of the class is a `vi.fn()`             |
| `stubRoute({ params, queryParams })`                        | `src/test/vitest-create-mock.ts`                                        | Stub `ActivatedRoute` (observables and snapshot)                |
| `testData`                                                  | `src/test/test-data.ts`                                                 | Fixtures typed with the API DTOs                                |
| `EmptyRouteComponent`                                       | `src/test/empty-route.component.ts`                                     | Route destination whose content is irrelevant                   |
| `provideI18nTesting()`                                      | `src/i18n/mock-i18n.ts`                                                 | Real English translations; a missing key throws                 |
| `provideCurrentUser(user?)`                                 | `src/app/shared/current-user-testing.ts`                                | Mocked `CurrentUserService` (default timezone if no user given) |
| `provideModalTesting()` / `MockModalService`                | `src/app/shared/mock-modal.service.testing.ts`                          | Replace `ModalService` and simulate a closed / dismissed modal  |
| `provideNgbConfigTesting()` / `noAnimation`                 | `src/app/shared/form/oi-ngb-testing.ts`, `src/app/shared/test-utils.ts` | ng-bootstrap config without animations                          |
| `byIdComparisonFn`                                          | `src/app/shared/test-utils.ts`                                          | `compareWith` function for selects of `{ id }` objects          |

`toPage()` / `emptyPage()` are production helpers (`src/app/shared/utils/page.utils.ts`) and are handy to build `Page`
responses in tests too.

## Writing a component test

### Tester class

Each spec declares a small tester class holding the fixture and the locators. Use `readonly` fields for static
locators, and methods only for dynamic ones (e.g. a row by index).

```typescript
class EngineDetailComponentTester {
  readonly fixture = TestBed.createComponent(EngineDetailComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly restartButton = this.root.getByRole('button', { name: 'Restart' });
  readonly scanModes = this.root.getByCss('tbody tr');

  scanMode(index: number) {
    return this.scanModes.nth(index);
  }
}
```

Scope locators to the component (`this.root`) so that they cannot match leftovers of another component. Modals and
other ng-bootstrap overlays are attached to `<body>`, so locate them from `page`.

### Locators

Prefer, in this order:

1. Semantic locators: `getByRole('button', { name: 'Save' })`, `getByLabelText('Name')`, `getByText('…')`.
   Translations are real (`provideI18nTesting()`), so use the English labels.
2. `getByTestId('…')` with a `data-testid` attribute in the template, when there is no accessible name.
3. `getByCss('…')` as a last resort.

Icon-only buttons have no accessible name: rather than adding an id, give them a translated `aria-label`, which fixes
both the test and the accessibility.

### Interact through the DOM

Test what the user sees and does: click buttons, fill inputs, select options, then assert on the DOM and on the
mocked services. Calling component methods (`componentInstance.save()`) or setting form controls directly skips the
template, so bindings, `disabled` states and validation messages stay untested.

```typescript
await tester.name.fill('My connector');
await tester.saveButton.click();

expect(southConnectorService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'My connector' }));
await expect.element(tester.root.getByText('Name is required')).not.toBeInTheDocument();
```

| Action         | Code                                   |
| -------------- | -------------------------------------- |
| Click / toggle | `await locator.click()`                |
| Type           | `await locator.fill('value')`          |
| Select         | `await locator.selectOptions('Label')` |
| Upload a file  | `await locator.upload(file)`           |
| Hover          | `await locator.hover()`                |

Accessing `componentInstance` is fine for a modal's public API called by its opener (`prepareForCreation(…)`,
`initialize(…)`) or to read an `output()`.

### Assertions

DOM assertions go through `expect.element()` and **must be awaited**: they retry until the expectation passes or times
out, which absorbs change detection and asynchronous rendering.

```typescript
await expect.element(tester.title).toHaveTextContent('Engine');
await expect.element(tester.scanModes).toHaveLength(3);
await expect.element(tester.saveButton).toBeDisabled();
await expect.element(tester.error).not.toBeInTheDocument();
await expect.element(tester.select).toHaveDisplayValue('Option 1');
```

Avoid synchronous DOM reads (`locator.element().textContent`, `querySelector`, `By.css`): they do not retry, and
`toBeTruthy()` on an element proves very little.

### Change detection

The application and the tests are **zoneless** (`provideZonelessChangeDetection()`, no zone.js). Fixtures detect
changes automatically, the same way the application does: after a template event (click, input…), after a signal used
by a template changes, or after `markForCheck()`.

So in tests:

- don't call `fixture.detectChanges()`: create the component, call its setup method if any (e.g. a modal's
  `prepareForCreation()`), then interact and assert with locators. `await expect.element()` retries until the
  component is rendered. Use `await fixture.whenStable()` when a non-DOM assertion needs rendering to be done.
- don't change component state from the test (setting a field, calling a method that changes plain fields) once the
  component is rendered: Angular is not notified, and `detectChanges()` fails with `NG0100:
ExpressionChangedAfterItHasBeenCheckedError`. Drive the component through its template instead.

And in components:

- keep state rendered by the template in signals, especially state changed asynchronously (HTTP responses, modal
  results, `await`, timers): a plain field changed in a `subscribe()` callback or after an `await` is not rendered. When a signal is not practical (e.g. an array shared with a modal and mutated in place), call
  `ChangeDetectorRef.markForCheck()` after the change.
- a template event already notifies Angular, so plain fields changed synchronously by an event handler are fine.

### Routed components

Use `RouterTestingHarness` when the component reads the router state, and `stubRoute()` when it only needs an
`ActivatedRoute`. When the component navigates, declare the destination with `EmptyRouteComponent`
(`src/test/empty-route.component.ts`) so that the navigation succeeds and can be asserted:

```typescript
provideRouter([{ path: 'south/:southId', component: EmptyRouteComponent }]);
// ...
await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/south/southId1'));
```

`stubRoute()` example:

```typescript
{ provide: ActivatedRoute, useValue: stubRoute({ params: { southId: 'southId1' } }) }
```

## Mocking

```typescript
let southConnectorService: MockObject<SouthConnectorService>;

beforeEach(() => {
  southConnectorService = createMock(SouthConnectorService);
  southConnectorService.findById.mockReturnValue(of(testData.south.list[0]));

  TestBed.configureTestingModule({
    providers: [provideI18nTesting(), { provide: SouthConnectorService, useValue: southConnectorService }]
  });
});
```

- `createMock` only mocks methods. Fields (e.g. an `info$` observable) must be set on the mock.
- Read call arguments with `mock.lastCall` / `mock.calls[n]`, and prefer `toHaveBeenCalledWith(…)` over a bare
  `toHaveBeenCalled()`.
- Modals: use `provideModalTesting()` and `MockModalService` rather than mocking `ModalService.open` with a cast:

  ```typescript
  const modalService = TestBed.inject(MockModalService);
  const fakeModal = createMock(EditScanModeModalComponent);
  modalService.mockClosedModal(fakeModal, scanMode);
  ```

## Fixtures

- Use `testData` from `src/test/test-data.ts`. It is typed with the DTOs returned by the API: never cast a fixture
  (`as unknown as …`, `as any`), add or fix the fixture instead. Never import the backend test data.
- `testData` is shared by all the tests of a file: `structuredClone()` it before handing it to a component that may
  mutate it.

## Services

HTTP services are tested with `HttpTestingController`, and `verify()` is called after each test:

```typescript
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
  service = TestBed.inject(IpFilterService);
});

afterEach(() => http.verify());

test('should update an IP filter', async () => {
  const result = firstValueFrom(service.update('id1', command));

  const request = http.expectOne({ method: 'PUT', url: '/api/ip-filters/id1' });
  expect(request.request.body).toEqual(command);
  request.flush(null);

  await expect(result).resolves.toBeNull();
});
```

Check the request body and parameters, not only the URL. Await observables with `firstValueFrom` / `lastValueFrom`
rather than asserting inside `subscribe()`, which silently passes if nothing is emitted.

## Time

- Use Vitest fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`, `vi.setSystemTime()`), and restore them
  in an `afterEach(() => vi.useRealTimers())` so that a failing test does not leak them. `fakeAsync()`/`tick()` are
  not supported.
- Never wait with a real `setTimeout`: it makes the test slow and flaky.
- Components that poll (metrics, registration status) keep polling with real timers: fake the timers or stop the
  fixture (`fixture.destroy()`) when the test is done with it.
