import { ArrayPage } from './array-page';

describe('array-page', () => {
  it('should work fine when length is a multiple of size', () => {
    const page = new ArrayPage<string>(['a', 'b', 'c', 'd', 'e', 'f'], 3);
    expect(page.size).toBe(3);
    expect(page.content).toEqual(['a', 'b', 'c']);
    expect(page.number).toBe(0);
    expect(page.totalElements).toBe(6);
    expect(page.totalPages).toBe(2);

    page.gotoPage(1);
    expect(page.size).toBe(3);
    expect(page.content).toEqual(['d', 'e', 'f']);
    expect(page.number).toBe(1);
    expect(page.totalElements).toBe(6);
    expect(page.totalPages).toBe(2);
  });

  it('should work fine when length is a not multiple of size', () => {
    const page = new ArrayPage<string>(['a', 'b', 'c', 'd', 'e'], 3);
    expect(page.size).toBe(3);
    expect(page.content).toEqual(['a', 'b', 'c']);
    expect(page.number).toBe(0);
    expect(page.totalElements).toBe(5);
    expect(page.totalPages).toBe(2);

    page.gotoPage(1);
    expect(page.size).toBe(3);
    expect(page.content).toEqual(['d', 'e']);
    expect(page.number).toBe(1);
    expect(page.totalElements).toBe(5);
    expect(page.totalPages).toBe(2);
  });
});
