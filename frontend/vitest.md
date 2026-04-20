# Vitest Migration Guide

This document describes the Vitest infrastructure setup for migrating from Jasmine/Karma to Vitest for unit testing.
The new tests should use Vitest Browser mode and its locator system.

Note that, in order to be testable with vitest, all the components used in the tests must be zoneless-compatible.
And zoneless components should use the OnPush detection strategy.

Also note that `fakeAsync()` does not work with vitest and zoneless, so if fake asynchrony is really needed in a test,
Vitest fake timers should be used instead.

## Test helpers

### `src/test/test.ts`

Extends Vitest's locator system with a custom `getByCss` selector:

```typescript
locators.extend({
  getByCss(selector: string) {
    return selector;
  }
});
```

This allows using CSS selectors for element queries, providing a transition path from ngx-speculoos syntax.

### `src/test/vitest-create-mock.ts`

Provides a `createMock<T>()` function for creating mock objects of Angular services,
corresponding to the one from ngx-speculoos but adapted for Vitest's mocking system.

### `src/app/current-user-testing-vitest.ts`

Vitest compatible version of the current user testing utilities in `current-user-testing.ts`

# Jasmine to Vitest Migration Guide with Locator Pattern

This guide documents the migration from Jasmine/Karma to Vitest for Angular projects,
using the locator pattern for component testing.

## Table of Contents

1. [Test File Changes](#test-file-changes)
2. [Locator Pattern](#locator-pattern)
3. [Assertions](#assertions)
4. [Mocking](#mocking)
5. [Time Mocking](#time-mocking)
6. [Stub Measurement Typeahead](#stub-measurement-typeahead)
7. [ngb-typeahead Interactions](#ngb-typeahead-interactions)
8. [Period Duration Selection](#period-duration-selection)
9. [Datetime Picker](#datetime-picker)
10. [Common Patterns](#common-patterns)

## Test File Changes

When migrating an existing Jasmine/Karma spec, rename the file with `git mv` from `*.spec.ts` to `*.vitest.spec.ts` instead of creating a new file and deleting the old one. This preserves file history and makes review easier.

### Imports

**Before:**

```typescript
import { ComponentTester, createMock } from 'ngx-speculoos';
```

**After:**

```typescript
import { page, Locator } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMock, MockObject } from '../test/vitest-create-mock';
```

### Test Structure

**Before:**

```typescript
describe('MyComponent', () => {
  it('should work', () => {
    // test code
  });
});
```

**After:**

```typescript
describe('MyComponent', () => {
  test('should work', async () => {
    // test code with async/await
  });
});
```

Note: Replace `it()` with `test()` and make test functions `async`.

## Locator Pattern

### Component Tester Classes

**Before (ngx-speculoos):**

```typescript
class MyComponentTester extends ComponentTester<MyComponent> {
  constructor() {
    super(MyComponent);
  }

  get title() {
    return this.element('h1')!;
  }

  get saveButton() {
    return this.button('#save-button')!;
  }

  get items() {
    return this.elements('.item');
  }
}
```

**After (Locator pattern):**

```typescript
class MyComponentTester {
  readonly fixture = TestBed.createComponent(MyComponent);
  readonly title = page.getByRole('heading', { level: 1 });
  readonly saveButton = page.getByRole('button', { name: 'Save' });
  readonly items = page.getByCss('.item');
}
```

Always prefer semantic locators (`getByRole`, `getByLabelText`, `getByText`) over CSS selectors where possible.
Do not use getters for simple locators. Prefer `readonly` locator fields, and keep methods only for dynamic locators or Angular component/directive instance access.

### Routing Components

**Before:**

```typescript
class MyComponentTester extends RoutingTester {
  constructor() {
    super();
  }

  // ... locators
}

// In test:
tester = new MyComponentTester();
await tester.stable();
```

**After:**

```typescript
class MyComponentTester {
  readonly root: Locator;

  // ... locators

  constructor(readonly harness: RouterTestingHarness) {
    this.root = page.elementLocator(harness.fixture.nativeElement);
  }
}

// In test:
const tester = new MyComponentTester(
  await RouterTestingHarness.create('/path')
);
```

### Locator Methods

| ngx-speculoos                  | Vitest Locator                                      |
|--------------------------------|-----------------------------------------------------|
| `this.element('selector')`     | `page.getByCss('selector')`                         |
| `this.button('.my-button')`    | `page.getByRole('button', { name: 'Button Text' })` |
| `this.input('#my-input')`      | `page.getByLabelText('Input Label')`                |
| `this.select('#my-select')`    | `page.getByLabelText('Select Label')`               |
| `this.elements('.items')`      | `page.getByCss('.items')`                           |
| `this.component(MyComponent)`  | `page.getByCss('my-component-selector')`            |
| `this.components(MyComponent)` | `page.getByCss('my-component-selector')`            |

**Prefer semantic locators** (getByRole, getByLabelText, getByText) over CSS selectors where possible.

All locator methods (`getByCss`, `getByRole`, `getByLabelText`, etc.) can also be called on any child `Locator`,
not just on `page`. This is useful to scope queries to a specific subtree.

**Before:**

```typescript
const firstRow = tester.data[0];
const cells = firstRow.elements('td');
expect(cells[0]).toContainText('d1');
const deleteButton = tester.tagValues[1].button('button');
```

**After:**

```typescript
const firstRow = tester.data.nth(0);
const cells = firstRow.getByCss('td');
await expect.element(cells.nth(0)).toHaveTextContent('d1');
const deleteButton = tester.tagValues.nth(1).getByRole('button');
```

### Accessing Angular Component Instances

For Angular components/directives that don't have a matching DOM element (used as injected services or
accessed via the component tree), use `By.directive()` from `@angular/platform-browser` instead of a locator.

**Before (ngx-speculoos):**

```typescript
class MyComponentTester extends ComponentTester<MyComponent> {
  get auditLinks() {
    return this.components(AuditLinkComponent);
  }

  get tagValueSearch() {
    return this.component(TagValueSearchStubComponent);
  }
}
```

**After:**

```typescript
import { By } from '@angular/platform-browser';

class MyComponentTester {
  readonly fixture = TestBed.createComponent(MyComponent);

  get auditLinks(): Array<AuditLinkComponent> {
    return this.fixture.debugElement
      .queryAll(By.directive(AuditLinkComponent))
      .map(de => de.componentInstance);
  }

  get tagValueSearch(): TagValueSearchStubComponent {
    return this.fixture.debugElement
      .query(By.directive(TagValueSearchStubComponent))
      .componentInstance;
  }
}
```

Use locators (`page.getByCss('my-selector')`) when you only need to interact with or assert on the DOM.
Use `By.directive()` only when you need to access the **component instance** itself (e.g. to call methods on it).

### Accessing Nth Element

**Before:**

```typescript
const firstItem = tester.items[0];
const secondItem = tester.items[1];
```

**After:**

```typescript
const firstItem = tester.items.nth(0);
const secondItem = tester.items.nth(1);
```

### Getting All Elements

**Before:**

```typescript
const itemCount = tester.items.length;
for (const item of tester.items) {
  // do something
}
```

**After:**

```typescript
await expect.element(tester.items).toHaveLength(expectedCount);

for (const item of tester.items.elements()) {
  // do something with HTMLElement
}
```

### IDs and classes used for testing purposes

If you want to access to a specific element or to several specific elements, and if there is no way to use
semantic locators, instead of adding an ID or a CSS class to the element(s) like we used to do, prefer adding a  `data-testid` attribute, and then use `page.getByTestId()` or `locator.getByTestId()` to access it/them.

This avoids having duplicate IDs on the page (which is invalid), and avoids wondering why a CSS class
is set without any associated CSS rules.

**Before:**

```html

<div id="highlighted-section">...</div>
@for (report of reports; track report.id) {
<div class="report">...</div>
}
```

```typescript
class MyComponentTester extends ComponentTester<MyComponent> {
  constructor() {
    super(MyComponent);
  }

  get highlightedSection() {
    return this.element('#highlighted-section')!;
  }

  get reports() {
    return this.elements('.report');
  }
}
```

**After:**

```html

<div data-testid="highlighted-section">...</div>
@for (report of reports; track report.id) {
<div data-testid="report">...</div>
}
```

```typescript
class MyComponentTester {
  readonly fixture = TestBed.createComponent(MyComponent);
  readonly highlightedSection = page.getByTestId('highlighted-section');
  readonly reports = page.getByTestid('report');
}
```

### Icon buttons and links without text

Buttons and links which don't have any text and are only identifiable using their icon are not accessible.
The application has many other accessibility issues, but if we want to improve, it would be better to
fix them and add an internationalized text to these links and buttons using `aria-label`.

**Before:**

```html

<button id="save-button"><span class="fa-solid fa-save"></span></button>
```

```typescript
class MyComponentTester extends ComponentTester<MyComponent> {
  constructor() {
    super(MyComponent);
  }

  get saveButton() {
    return this.button('#save-button');
  }
}
```

**After:**

```html

<button [ariaLabel]="'common.save' | translate"><span class="fa-solid fa-save"></span></button>
```

```typescript
class MyComponentTester {
  readonly fixture = TestBed.createComponent(MyComponent);
  readonly saveButton = page.getByRole('button', { name: 'Save' });
}
```

## Assertions

All DOM-related assertions must be `await`ed in Vitest.

### Text Content

**Before:**

```typescript
expect(tester.title).toHaveText('Hello');
expect(tester.title).toHaveTrimmedText('Hello');
expect(tester.element).toContainText('Hello\u00a0world');
```

**After:**

```typescript
await expect.element(tester.title).toHaveTextContent('Hello');
await expect.element(tester.element).toHaveTextContent('Hello world'); // handles non-breaking spaces
```

### Visibility

**Before:**

```typescript
expect(tester.element).not.toBeNull();
expect(tester.element).toBeNull();
```

**After:**

```typescript
await expect.element(tester.element).toBeVisible();
await expect.element(tester.element).toBeInTheDocument();
await expect.element(tester.element).not.toBeInTheDocument();
```

### Attributes

**Before:**

```typescript
expect(tester.link.attr('href')).toBe('https://example.com');
expect(tester.input).toHaveValue('test');
```

**After:**

```typescript
await expect.element(tester.link).toHaveAttribute('href', 'https://example.com');
await expect.element(tester.input).toHaveValue('test');
await expect.element(tester.input).toHaveDisplayValue('test');
```

### Classes

**Before:**

```typescript
expect(tester.element).toHaveClass('active');
expect(tester.element).not.toHaveClass('disabled');
expect(tester.element.classes).toEqual(['foo', 'bar']);
```

**After:**

```typescript
await expect.element(tester.element).toHaveClass('active');
await expect.element(tester.element).not.toHaveClass('disabled');
await expect.element(tester.element).toHaveClass('foo', 'bar', { exact: true });
```

### Checked State

**Before:**

```typescript
expect(tester.checkbox).toBeChecked();
expect(tester.checkbox).not.toBeChecked();
```

**After:**

```typescript
await expect.element(tester.checkbox).toBeChecked();
await expect.element(tester.checkbox).not.toBeChecked();
```

### Disabled State

**Before:**

```typescript
expect(tester.input.disabled).toBe(true);
expect(tester.button.disabled).toBe(false);
```

**After:**

```typescript
await expect.element(tester.input).toBeDisabled();
await expect.element(tester.button).not.toBeDisabled();
```

### Select Elements

**Before:**

```typescript
expect(tester.select).toHaveSelectedLabel('Option 1');
expect(tester.select.optionLabels.length).toBe(3);
expect(tester.select.optionLabels[0]).toBe('Option 1');
```

**After:**

```typescript
await expect.element(tester.select).toHaveDisplayValue('Option 1');
const options = tester.select.getByRole('option');
await expect.element(options).toHaveLength(3);
await expect.element(options.nth(0)).toHaveTextContent('Option 1');
```

### Custom Matchers

**Before:**

```typescript
expect(value).withContext('Error message').toEqual(expected);
```

**After:**

```typescript
expect(value, 'Error message').toEqual(expected);
```

## Mocking

### Creating Mocks

**Before:**

```typescript
import { createMock } from 'ngx-speculoos';

let service: jasmine.SpyObj<MyService>;

beforeEach(() => {
  service = createMock(MyService);
});
```

**After:**

```typescript
import { createMock, MockObject } from '../test/vitest-create-mock';

let service: MockObject<MyService>;

beforeEach(() => {
  service = createMock(MyService);
});
```

### Mock Return Values

Vitest doesn't have `withArgs`, but we can have the equivalent by using [vitest-when](https://github.com/mcous/vitest-when#readme).

**Before:**

```typescript
service.getData.and.returnValue(of(data));
service.getData.withArgs(123).and.returnValue(of(specificData));
```

**After:**

```typescript
service.getData.mockReturnValue(of(data));
when(service.getData).calledWith(123).thenReturn(of(specificData));
```

### Mock Implementations

**Before:**

```typescript
service.getData.and.callFake(id => of(dataMap[id]));
```

**After:**

```typescript
service.getData.mockImplementation(id => of(dataMap[id]));
```

### Spying on Methods

**Before:**

```typescript
spyOn(router, 'navigate');
expect(router.navigate).toHaveBeenCalledWith(['/path']);
```

**After:**

```typescript
vi.spyOn(router, 'navigate');
expect(router.navigate).toHaveBeenCalledWith(['/path']);
```

### Resetting Mocks

**Before:**

```typescript
service.getData.calls.reset();
```

**After:**

```typescript
service.getData.mockReset();
```

### Checking Calls

**Before:**

```typescript
expect(service.getData).toHaveBeenCalled();
expect(service.getData).toHaveBeenCalledWith(123);
expect(service.getData).not.toHaveBeenCalled();
const args = service.getData.calls.mostRecent().args;
const firstArg = service.getData.calls.mostRecent().args[0];
```

**After:**

```typescript
expect(service.getData).toHaveBeenCalled();
expect(service.getData).toHaveBeenCalledWith(123);
expect(service.getData).not.toHaveBeenCalled();
const args = service.getData.mock.lastCall;
const firstArg = service.getData.mock.lastCall?.[0];
```

## Time Mocking

**Before (Jasmine):**

```typescript
beforeEach(() => {
  jasmine.clock().mockDate(new Date('2025-01-10'));
});

afterEach(() => {
  jasmine.clock().uninstall();
});
```

**After (Vitest):**

```typescript
import { vi } from 'vitest';
import { parseISO } from 'date-fns';

beforeEach(() => {
  vi.setSystemTime(parseISO('2025-01-10'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Stub Measurement Typeahead

To test components that use `MeasurementTypeaheadDirective`, replace it with `StubMeasurementTypeaheadDirective`
and interact with it via the `selectMeasurement()` locator extension and `toHaveDisplayedMeasurement()` custom matcher,
both defined in `src/test/test.ts`. The locator in the tester is a plain `page.getByCss()`.

Note that `StubMeasurementTypeaheadDirective` must be passed explicitly to `selectMeasurement()` as a second argument
(a current limitation of the implementation).

**Before:**

```typescript
import { TestStubMeasurementTypeahead } from '../shared/typeahead/measurement/measurement-typeahead.stub';

class MyComponentTester extends ComponentTester<TestComponent> {
  get measurement() {
    return this.custom('#formula-test-measurement', TestStubMeasurementTypeahead);
  }
}

// In tests:
tester.measurement.selectValue(someMeasurement);
expect(tester.measurement.selectedValue).toEqual(someMeasurement);
```

**After:**

```typescript
import { StubMeasurementTypeaheadDirective } from '../shared/typeahead/measurement/measurement-typeahead.stub';

// In the tester class:
class MyComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly measurement = page.getByCss('#formula-test-measurement');
}

// In tests:
await tester.measurement.selectMeasurement(someMeasurement, StubMeasurementTypeaheadDirective);
await expect.element(tester.measurement).toHaveDisplayedMeasurement(someMeasurement);
await expect.element(tester.measurement).toHaveDisplayedMeasurement('Temperature'); // or by name
await expect.element(tester.measurement).toHaveDisplayedMeasurement(null); // empty
```

## ngb-typeahead Interactions

For regular `ngbTypeahead` inputs (not the stub measurement typeahead), two helpers are available in `src/test/test.ts`:

- `selectLabel(label)` — locator extension to pick a suggestion from the open typeahead dropdown by its visible text.
- `toHaveSuggestionLabels(labels)` — custom matcher to assert which suggestions are currently visible.

Note that `provideNgbConfigTesting()` sets a very short debounce time (5 ms) for typeahead inputs, so you don't
need to fake timers to advance past the normal debounce delay.

**Before:**

```typescript
tester.tagValueTypeahead.fillWith('1');
expect(tester.tagValueTypeahead.suggestionLabels).toEqual(['Site1']);
tester.tagValueTypeahead.selectLabel('Site1');
```

**After:**

```typescript
await tester.tagValueTypeahead.fill('1');
await expect.element(tester.tagValueTypeahead).toHaveSuggestionLabels(['Site1']);
await tester.tagValueTypeahead.selectLabel('Site1');
```

## Period Duration Selection

To test components using `PeriodDurationSelectionComponent`, use the `selectPeriod()` locator extension
and the `toHaveSelectedPeriod()` custom matcher, both defined in `src/test/test.ts`.
The locator in the tester is just a regular `page.getByCss()` pointing at the `oi-period-duration-selection` element.

**Before:**

```typescript
import { TestPeriodDurationSelection } from '../shared/period-duration-selection/period-duration-selection.test-utils';

class MyComponentTester extends ComponentTester<TestComponent> {
  get computationResolution() {
    return this.custom('#formula-test-computation-resolution', TestPeriodDurationSelection);
  }
}

// In tests:
tester.computationResolution.selectPeriod('1d');
expect(tester.computationResolution.selectedPeriod).toBe('1d');
expect(tester.computationResolution).not.toBeNull();
```

**After:**

```typescript
class MyComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly computationResolution = page.getByCss('#formula-test-computation-resolution');
}

// In tests:
await tester.computationResolution.selectPeriod('1d');      // predefined period
await tester.computationResolution.selectPeriod('2h30m');   // custom free-form period
await tester.computationResolution.selectPeriod(null);      // no period selected
await expect.element(tester.computationResolution).toHaveSelectedPeriod('1d');
await expect.element(tester.computationResolution).not.toBeInTheDocument(); // check absence
```

## Datetime Picker

To test components using `OiDatetimepickerComponent`, use the `fillWithDate()` locator extension
and the `toHaveDisplayedDate()` custom matcher, both defined in `src/test/test.ts`.
The locator in the tester is just a regular `page.getByCss()` pointing at the datetimepicker element.

**Before:**

```typescript
import { TestDatetimepicker } from '../oi-ngb/datetimepicker/datetimepicker.test-utils';

class MyComponentTester extends ComponentTester<TestComponent> {
  get start() {
    return this.custom('#formula-test-start', TestDatetimepicker);
  }
}

// In tests:
tester.start.fillWith('24/09/2019', '12', '30');
expect(tester.start.displayedValue).toBe('24/09/2019 12:30:00');
```

**After:**

```typescript
class MyComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly start = page.getByCss('#formula-test-start');
}

// In tests:
await tester.start.fillWithDate('24/09/2019', '12', '30');
await expect.element(tester.start).toHaveDisplayedDate('24/09/2019 12:30:00');
```

## Common Patterns

### User Interactions

**Before:**

```typescript
await tester.button.click();
await tester.input.fillWith('value');
await tester.checkbox.check();
await tester.checkbox.uncheck();
await tester.select.selectLabel('Option 1');
```

**After:**

```typescript
await tester.button.click();
await tester.input.fill('value');
await tester.checkbox.click(); // to check
await tester.checkbox.click(); // to uncheck (toggle)
await tester.select.selectOptions('Option 1');
```

### Waiting for Stability

**Before:**

```typescript
tester = new MyComponentTester();
await tester.stable();
```

**After:**

```typescript
// Usually not needed with locators, but if required (AND ONLY IF REQUIRED):
await tester.fixture.whenStable();
```

### Router URL Checks

**Before:**

```typescript
expect(tester.url).toBe('/path');
```

**After:**

```typescript
const router = TestBed.inject(Router);
expect(router.url).toBe('/path');
```

### Accessing Component Instance

**Before:**

```typescript
tester.componentInstance.someProperty.set('value');
```

**After:**

```typescript
class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly componentInstance = this.fixture.componentInstance;
}

tester.componentInstance.someProperty.set('value');
```

### Test Component with Inputs

**Before:**

```typescript

@Component({
  template: '<my-component [input]="value" />',
  imports: [MyComponent]
})
class TestComponent {
  value = signal('initial');
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }
}
```

**After:**

```typescript

@Component({
  template: '<my-component [input]="value" />',
  imports: [MyComponent]
})
class TestComponent {
  readonly value = signal('initial');
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  // ... locators
}
```

## Migration Checklist

- [ ] Update all test files:
  - [ ] Change imports (add vitest imports, remove ngx-speculoos)
  - [ ] Change `it()` to `test()`
  - [ ] Make test functions `async`
  - [ ] Replace `ComponentTester` subclasses with plain classes using `page` locators
  - [ ] Replace `this.component()` / `this.components()` with `By.directive()` when component instance access is needed
  - [ ] Replace child element access (`tester.items[0].elements('td')`) with child locators (`tester.items.nth(0).getByCss('td')`)
  - [ ] Update all DOM assertions to use `await expect.element()`
  - [ ] Replace `toBeNull()` / `not.toBeNull()` with `not.toBeInTheDocument()` / `toBeInTheDocument()`
  - [ ] Replace `.disabled` property checks with `toBeDisabled()` / `not.toBeDisabled()`
  - [ ] Replace `jasmine.SpyObj<T>` with `MockObject<T>` from `vitest-create-mock`
  - [ ] Replace `.and.returnValue()` with `.mockReturnValue()`
  - [ ] Replace `.and.callFake()` with `.mockImplementation()`
  - [ ] Replace `spyOn()` with `vi.spyOn()`
  - [ ] Update time mocking (`jasmine.clock()` → `vi.setSystemTime()` / `vi.useRealTimers()`)
  - [ ] Replace `tester.input.fillWith()` with `await tester.input.fill()`
  - [ ] Replace `tester.select.selectLabel()` with `await tester.select.selectOptions()`
  - [ ] Replace `tester.checkbox.check()` / `uncheck()` with `await tester.checkbox.click()`
  - [ ] Replace typeahead interactions (`fillWith`, `suggestionLabels`, `selectLabel`) with new locator extensions
  - [ ] Remove unnecessary stability waits; use `await tester.fixture.whenStable()` only when needed
  - [ ] Replace `provideCurrentUser` with `provideCurrentUser` from `current-user-testing-vitest`
  - [ ] Rename the file by replacing `.spec.ts` by `.vitest.spec.test`
  - [ ] Run tests and fix any remaining issues

## Notes

- **Prefer semantic locators**: Use `getByRole`, `getByLabelText`, `getByText` over CSS selectors when possible. This makes tests more resilient and accessible.
- **Async/await is required**: All DOM interactions and assertions must be awaited.
