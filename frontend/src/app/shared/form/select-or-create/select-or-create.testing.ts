import { expect } from 'vitest';
import { Locator, page } from 'vitest/browser';

/**
 * The dropdown menu of an `oib-select-or-create`, given its button (located by its label), opened: its entries are
 * hidden while it is closed.
 */
async function openMenu(select: Locator): Promise<Locator> {
  await expect.element(select).toBeVisible();
  if (select.element().getAttribute('aria-expanded') !== 'true') {
    await select.click();
  }
  const menu = page.elementLocator(document.getElementById(`${select.element().id}-menu`)!);
  await expect.element(menu).toBeVisible();
  return menu;
}

/** Opens the dropdown of an `oib-select-or-create`, given its button, and clicks the entry of the given name */
export async function chooseSelectOrCreateEntry(select: Locator, name: string): Promise<void> {
  const menu = await openMenu(select);
  await menu.getByRole('button', { name, exact: true }).click();
  await expect.element(select).toHaveAttribute('aria-expanded', 'false');
}

/** Opens the dropdown of an `oib-select-or-create`, given its button, and gives the names of its entries */
export async function selectOrCreateEntryNames(select: Locator): Promise<Array<string>> {
  const menu = await openMenu(select);
  return menu
    .getByRole('button')
    .elements()
    .map(entry => entry.textContent!.trim());
}
