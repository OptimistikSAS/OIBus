import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import OIbPassword from './OIbPassword.jsx'
import { minLength } from '../../../services/validation.service'

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
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbPassword', () => {
  test('check Password with value="a password"', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        label="label"
        value="a text"
        name="name"
        onChange={() => (1)}
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with too short value', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        label="label"
        name="name"
        onChange={() => (1)}
        value="password"
        valid={minLength(10)}
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with no label', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with help', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check input key down', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    Simulate.keyDown(document.querySelector('input'), { target: { value: 'key' } })
    expect(setEdited).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
  test('check input edited', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    Simulate.keyDown(document.querySelector('input'), { target: { value: `${PREFIX}new_password` } })
    expect(setEdited).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
  test('check user cleared password', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    Simulate.change(document.querySelector('input'), { target: { value: '' } })
    expect(setEdited).toBeCalledWith(false)
    expect(container).toMatchSnapshot()
  })
  test('check input edited again', () => {
    edited = true
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    Simulate.keyDown(document.querySelector('input'), { target: { value: 'new_password' } })
    expect(setEdited).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
  test('check show password-false', () => {
    edited = true
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    Simulate.click(document.querySelector('div path'))
    expect(setShowPassword).toBeCalledWith(false)
    expect(container).toMatchSnapshot()
  })
  test('check show password-true', () => {
    showPassword = false
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    Simulate.click(document.querySelector('div path'))
    expect(setShowPassword).toBeCalledWith(true)
    expect(container).toMatchSnapshot()
  })
})
