/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import Modal from './Modal.jsx'

const setOpen = jest.fn()
const func = jest.fn()
const callback = { func }
const setCallback = jest.fn()
const setState = jest.fn()
React.useState = jest.fn()
  .mockImplementation((init) => {
    if (init === null) {
      return [callback, setCallback]
    }
    if (init === true) {
      return [init, setOpen]
    }
    return [init, setState]
  })

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('Modal', () => {
  test('check Modal', () => {
    act(() => {
      ReactDOM.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>,
        container,
      )
    })
    expect(container)
      .toMatchSnapshot()
  })
  test('check confirm press', () => {
    act(() => {
      ReactDOM.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>,
        container,
      )
    })
    Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    expect(callback.func)
      .toBeCalledWith()
    expect(setOpen)
      .toBeCalledWith(false)
    expect(setCallback)
      .toBeCalledWith(null)
    expect(container)
      .toMatchSnapshot()
  })
  test('check cancel press', () => {
    act(() => {
      ReactDOM.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>,
        container,
      )
    })
    Simulate.click(document.getElementsByClassName('btn btn-secondary')[0])
    expect(setOpen)
      .toBeCalledWith(false)
    expect(setCallback)
      .toBeCalledWith(null)
    expect(container)
      .toMatchSnapshot()
  })
})
