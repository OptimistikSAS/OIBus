/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import Modal from './modal.jsx'

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

describe('Modal', () => {
  test('check Modal', () => {
    act(() => {
      root.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>,
      )
    })
    expect(container)
      .toMatchSnapshot()
  })
  test('check confirm press', () => {
    act(() => {
      root.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>,
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
      root.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>,
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
