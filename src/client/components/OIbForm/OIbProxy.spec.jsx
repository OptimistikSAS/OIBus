/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'
import newConfig from '../../../../tests/testConfig'
import OIbProxy from './OIbProxy.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbProxy', () => {
  test('check Proxy with value="proxy"', () => {
    act(() => {
      ReactDOM.render(<OIbProxy
        label="label"
        value="proxy"
        name="name"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy with value="proxy" and no label', () => {
    act(() => {
      ReactDOM.render(<OIbProxy
        value="some text"
        name="name"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy with value and help text', () => {
    act(() => {
      ReactDOM.render(<OIbProxy
        label="label"
        value="proxy"
        help={<div>some help text</div>}
        name="name"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy with no value', () => {
    act(() => {
      ReactDOM.render(<OIbProxy
        label="label"
        value={null}
        help={<div>some help text</div>}
        name="name"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Proxy change', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbProxy
        label="label"
        value="proxy"
        help={<div>some help text</div>}
        name="name"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name'), { target: { value: 'new_proxy' } })
    expect(onChange).toBeCalledWith('name', 'new_proxy', null)
    expect(container).toMatchSnapshot()
  })
})
