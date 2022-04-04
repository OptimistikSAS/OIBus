/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import TablePagination from './TablePagination.jsx'

const onPagePressed = jest.fn()

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

describe('TablePagination', () => {
  test('check TablePagination', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={10}
        onPagePressed={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check when not first page', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={11}
        total={100}
        onPagePressed={onPagePressed}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check press first page', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={10}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[0])
    expect(onPagePressed).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check press prev page', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={2}
        total={30}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[1])
    expect(onPagePressed).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check press prev page incorect selected', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={-1}
        total={30}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[1])
    expect(onPagePressed).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check press next page', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={2}
        total={3}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[5])
    expect(onPagePressed).toBeCalledWith(3)
    expect(container).toMatchSnapshot()
  })
  test('check press next page incorect selected', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={3}
        total={3}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[5])
    expect(onPagePressed).toBeCalledWith(3)
    expect(container).toMatchSnapshot()
  })
  test('check press last page', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={2}
        total={3}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[6])
    expect(onPagePressed).toBeCalledWith(3)
    expect(container).toMatchSnapshot()
  })
  test('check press second page', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={10}
        onPagePressed={onPagePressed}
      />)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[3])
    expect(onPagePressed).toBeCalledWith(2)
    expect(container).toMatchSnapshot()
  })
  test('check maxToDisplay > total', () => {
    act(() => {
      root.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={9}
        onPagePressed={onPagePressed}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
