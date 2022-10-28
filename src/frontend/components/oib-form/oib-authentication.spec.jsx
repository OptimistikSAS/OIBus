/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibAuthentication from './oib-authentication.jsx'

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
      root.render(<OibAuthentication
        value={{ type: 'Basic', key: 'user', secret: 'pass' }}
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with mode API Key', () => {
    act(() => {
      root.render(<OibAuthentication
        value={{ type: 'API Key', key: 'aaaaaa', secret: 'sssss' }}
        name="name"
        onChange={() => (1)}
        mode="API Key"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with mode Bearer', () => {
    act(() => {
      root.render(<OibAuthentication
        value={{ type: 'Bearer', secret: 'sssss' }}
        name="name"
        onChange={() => (1)}
        mode="Bearer"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with mode Basic', () => {
    act(() => {
      root.render(<OibAuthentication
        value={{ type: 'Basic', key: 'user', secret: 'pass' }}
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
      root.render(<OibAuthentication
        value={{ type: 'Basic', key: 'anyUser', secret: 'anyPass' }}
        name="anyname"
        onChange={onChangeMock}
      />)
    })

    const userField = container.querySelector('#key')
    const passwordField = container.querySelector('#secret')
    Simulate.change(userField, { target: { value: 'toto' } })
    expect(onChangeMock).toBeCalledWith('anyname.key', 'toto', null)
    Simulate.change(passwordField, { target: { value: 'passpass' } })
    expect(onChangeMock).toBeCalledWith('anyname.secret', '{{notEncrypted}}passpass', null)
    // Test second render and componentDidUpdate
  })
  test('check the returned value (custom authentication)', () => {
    const onChangeMock = jest.fn()
    act(() => {
      root.render(<OibAuthentication
        value={{ type: 'API Key', key: 'anyHeader', secret: 'anySecretKey' }}
        name="anyname"
        onChange={onChangeMock}
      />)
    })

    const keyField = container.querySelector('#key')
    const secretField = container.querySelector('#secret')
    Simulate.change(keyField, { target: { value: 'toto' } })
    expect(onChangeMock).toBeCalledWith('anyname.key', 'toto', null)
    Simulate.change(secretField, { target: { value: 'passpass' } })
    expect(onChangeMock).toBeCalledWith('anyname.secret', '{{notEncrypted}}passpass', null)
  })
})
