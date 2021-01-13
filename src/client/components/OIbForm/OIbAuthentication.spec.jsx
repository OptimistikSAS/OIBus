import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import OIbAuthentication from './OIbAuthentication.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbAuthentication', () => {
  test('check Authentication with default mode (user/password)', () => {
    act(() => {
      ReactDOM.render(<OIbAuthentication
        value={{ type: 'Basic', username: 'user', password: 'pass' }}
        name="name"
        onChange={() => (1)}
      />, container)
    })

    // need to replace random id and toggler with fixed values
    // so the snapshot can be compared between test runs
    const button = container.querySelector('.close')
    const div = container.querySelector('.collapse')
    button.id = 'id'
    div.setAttribute('toggler', 'toggler')
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with "custom" mode (headerName/secretKey)', () => {
    act(() => {
      ReactDOM.render(<OIbAuthentication
        value={{ type: 'API Key', key: 'anyHeader', secretKey: 'anySecretKey' }}
        name="name"
        onChange={() => (1)}
      />, container)
    })
    // need to replace random id and toggler with fixed values
    // so the snapshot can be compared between test runs
    const button = container.querySelector('.close')
    const div = container.querySelector('.collapse')
    button.id = 'id'
    div.setAttribute('toggler', 'toggler')
    expect(container).toMatchSnapshot()
  })
  test('check Authentication with  mode accessKey', () => {
    act(() => {
      ReactDOM.render(<OIbAuthentication
        value={{ type: 'Basic', accessKey: 'aaaaaa', secretKey: 'sssss' }}
        name="name"
        onChange={() => (1)}
        mode="accessKey"
      />, container)
    })
    // need to replace random id and toggler with fixed values
    // so the snapshot can be compared between test runs
    const button = container.querySelector('.close')
    const div = container.querySelector('.collapse')
    button.id = 'id'
    div.setAttribute('toggler', 'toggler')
    expect(container).toMatchSnapshot()
  })
  test('check the returned value', () => {
    const onChangeMock = jest.fn()
    act(() => {
      ReactDOM.render(<OIbAuthentication
        value={{ type: 'Basic', username: 'anyUser', password: 'anyPass' }}
        name="anyname"
        onChange={onChangeMock}
      />, container)
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
      ReactDOM.render(<OIbAuthentication
        value={{ type: 'API Key', key: 'anyHeader', secretKey: 'anySecretKey' }}
        name="anyname"
        onChange={onChangeMock}
      />, container)
    })

    const keyField = container.querySelector('#key')
    const secretField = container.querySelector('#secretKey')
    Simulate.change(keyField, { target: { value: 'toto' } })
    expect(onChangeMock).toBeCalledWith('anyname.key', 'toto', null)
    Simulate.change(secretField, { target: { value: 'passpass' } })
    expect(onChangeMock).toBeCalledWith('anyname.secretKey', '{{notEncrypted}}passpass', null)
  })
})
