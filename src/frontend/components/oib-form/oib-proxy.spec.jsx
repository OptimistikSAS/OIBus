/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import newConfig from '../../../../tests/test-config'
import OibProxy from './oib-proxy.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })

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

describe('OIbProxy', () => {
  test('check Proxy with value="proxy"', () => {
    act(() => {
      root.render(<OibProxy
        label="label"
        value="proxy"
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy with value="proxy" and no label', () => {
    act(() => {
      root.render(<OibProxy
        value="some text"
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy with value and help text', () => {
    act(() => {
      root.render(<OibProxy
        label="label"
        value="proxy"
        help={<div>some help text</div>}
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy with no value', () => {
    act(() => {
      root.render(<OibProxy
        label="label"
        value={null}
        help={<div>some help text</div>}
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy change', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibProxy
        label="label"
        value="proxy"
        help={<div>some help text</div>}
        name="name"
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('name'), { target: { value: 'new_proxy' } })
    expect(onChange).toBeCalledWith('name', 'new_proxy', null)
    expect(container).toMatchSnapshot()
  })
})
