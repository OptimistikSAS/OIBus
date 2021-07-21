/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import TablePagination from './TablePagination.jsx'

const onPagePressed = jest.fn()

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('TablePagination', () => {
  test('check TablePagination', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={10}
        onPagePressed={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check when not first page', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={11}
        total={100}
        onPagePressed={onPagePressed}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check press first page', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={10}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[0])
    expect(onPagePressed).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check press prev page', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={2}
        total={30}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[1])
    expect(onPagePressed).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check press prev page incorect selected', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={-1}
        total={30}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[1])
    expect(onPagePressed).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check press next page', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={2}
        total={3}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[5])
    expect(onPagePressed).toBeCalledWith(3)
    expect(container).toMatchSnapshot()
  })
  test('check press next page incorect selected', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={3}
        total={3}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[5])
    expect(onPagePressed).toBeCalledWith(3)
    expect(container).toMatchSnapshot()
  })
  test('check press last page', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={2}
        total={3}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[6])
    expect(onPagePressed).toBeCalledWith(3)
    expect(container).toMatchSnapshot()
  })
  test('check press second page', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={10}
        onPagePressed={onPagePressed}
      />, container)
    })
    Simulate.click(document.getElementsByClassName('pagination-cell')[3])
    expect(onPagePressed).toBeCalledWith(2)
    expect(container).toMatchSnapshot()
  })
  test('check maxToDisplay > total', () => {
    act(() => {
      ReactDOM.render(<TablePagination
        maxToDisplay={10}
        selected={1}
        total={9}
        onPagePressed={onPagePressed}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
