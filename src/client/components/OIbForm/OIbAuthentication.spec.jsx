/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OIbAuthentication from './OIbAuthentication.jsx'

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

describe('OIbAuthentication', () => {
  test('check Authentication with mode null', () => {
    act(() => {
      root.render(<OIbAuthentication
        value={{ type: 'Basic', username: 'user', password: 'pass' }}
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with mode API Key', () => {
    act(() => {
      root.render(<OIbAuthentication
        value={{ type: 'API Key', key: 'aaaaaa', secretKey: 'sssss' }}
        name="name"
        onChange={() => (1)}
        mode="API Key"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with mode Bearer', () => {
    act(() => {
      root.render(<OIbAuthentication
        value={{ type: 'Bearer', token: 'sssss' }}
        name="name"
        onChange={() => (1)}
        mode="Bearer"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with mode Basic', () => {
    act(() => {
      root.render(<OIbAuthentication
        value={{ type: 'Basic', username: 'user', password: 'pass' }}
        name="name"
        onChange={() => (1)}
        mode="Basic"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check the returned value', () => {
    const onChangeMock = jest.fn()
    act(() => {
      root.render(<OIbAuthentication
        value={{ type: 'Basic', username: 'anyUser', password: 'anyPass' }}
        name="anyname"
        onChange={onChangeMock}
      />)
    })

    const userField = container.querySelector('#username')
    const passwordField = container.querySelector('#password')
    Simulate.change(userField, { target: { value: 'toto' } })
    expect(onChangeMock).toBeCalledWith('anyname.username', 'toto', null)
    Simulate.change(passwordField, { target: { value: 'passpass' } })
    expect(onChangeMock).toBeCalledWith('anyname.password', '{{notEncrypted}}passpass', null)
    // Test second render and componentDidUpdate
  })
  test('check the returned value (custom authentication)', () => {
    const onChangeMock = jest.fn()
    act(() => {
      root.render(<OIbAuthentication
        value={{ type: 'API Key', key: 'anyHeader', secretKey: 'anySecretKey' }}
        name="anyname"
        onChange={onChangeMock}
      />)
    })

    const keyField = container.querySelector('#key')
    const secretField = container.querySelector('#secretKey')
    Simulate.change(keyField, { target: { value: 'toto' } })
    expect(onChangeMock).toBeCalledWith('anyname.key', 'toto', null)
    Simulate.change(secretField, { target: { value: 'passpass' } })
    expect(onChangeMock).toBeCalledWith('anyname.secretKey', '{{notEncrypted}}passpass', null)
  })
})
