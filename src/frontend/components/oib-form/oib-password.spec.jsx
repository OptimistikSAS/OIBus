/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibPassword from './oib-password.jsx'
import { minLength } from '../../../service/validation.service'

const PREFIX = '{{notEncrypted}}'

// used to determine current state init
let initState = 'edited'

// state mocks
let edited = false
const setEdited = jest.fn()
let showPassword = true
const setShowPassword = jest.fn()
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === false && initState === 'edited') {
    initState = 'showPassword'
    return [edited, setEdited]
  }
  if (init === false && initState === 'showPassword') {
    initState = 'edited'
    return [showPassword, setShowPassword]
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

describe('OIbPassword', () => {
  test('check Password with value="a password"', () => {
    act(() => {
      root.render(<OibPassword
        label="label"
        value="a text"
        name="name"
        onChange={() => (1)}
        defaultValue="default"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with too short value', () => {
    act(() => {
      root.render(<OibPassword
        label="label"
        name="name"
        onChange={() => (1)}
        value="password"
        valid={minLength(10)}
        defaultValue="default"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with no label', () => {
    act(() => {
      root.render(<OibPassword
        name="name"
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with help', () => {
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check input key down', () => {
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    Simulate.keyDown(document.querySelector('input'), { target: { value: 'key' } })
    expect(setEdited).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
  test('check input edited', () => {
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    Simulate.keyDown(document.querySelector('input'), { target: { value: `${PREFIX}new_password` } })
    expect(setEdited).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
  test('check user cleared password', () => {
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    Simulate.change(document.querySelector('input'), { target: { value: '' } })
    expect(setEdited).toBeCalledWith(false)
    expect(container).toMatchSnapshot()
  })
  test('check input edited again', () => {
    edited = true
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    Simulate.keyDown(document.querySelector('input'), { target: { value: 'new_password' } })
    expect(setEdited).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
  test('check show password-false', () => {
    edited = true
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    Simulate.click(document.querySelector('div path'))
    expect(setShowPassword).toBeCalledWith(false)
    expect(container).toMatchSnapshot()
  })
  test('check show password-true', () => {
    showPassword = false
    act(() => {
      root.render(<OibPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />)
    })
    Simulate.click(document.querySelector('div path'))
    expect(setShowPassword).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
})
