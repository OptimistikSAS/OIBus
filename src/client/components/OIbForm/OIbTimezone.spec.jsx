/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OIbTimezone from './OIbTimezone.jsx'
import { notEmpty } from '../../../services/validation.service'

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

describe('OIbTimezone', () => {
  test('check Select with value="Europe/Paris"', () => {
    act(() => {
      root.render(<OIbTimezone
        name="name"
        label="label"
        onChange={() => (1)}
        value="Europe/Paris"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbTimezone with value="Europe/Paris" and no label', () => {
    act(() => {
      root.render(<OIbTimezone
        name="name"
        onChange={() => (1)}
        value="Europe/Paris"
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbTimezone with value="Europe/Paris" and help', () => {
    act(() => {
      root.render(<OIbTimezone
        name="name"
        label="label"
        help={<div>helpt text</div>}
        onChange={() => (1)}
        value="Europe/Paris"
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbTimezone with value="" and valid funtion', () => {
    act(() => {
      root.render(<OIbTimezone
        name="name"
        label="label"
        onChange={() => (1)}
        value=""
        valid={notEmpty()}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OIbTimezone
        name="name"
        label="label"
        onChange={onChange}
        value=""
        valid={notEmpty()}
      />)
    })
    Simulate.change(document.querySelector('select'), { target: { value: 'new_value' } })
    expect(onChange).toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
