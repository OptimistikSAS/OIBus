/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibSelect from './oib-select.jsx'
import { minLength } from '../../../service/validation.service.js'

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

describe('OIbSelect', () => {
  test('check Select with value="some text"', () => {
    act(() => {
      root.render(<OibSelect
        name="name"
        label="label"
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Select with value="some text" and no label', () => {
    act(() => {
      root.render(<OibSelect
        name="name"
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Select with value="some text" and help', () => {
    act(() => {
      root.render(<OibSelect
        name="name"
        label="label"
        help={<div>helpt text</div>}
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Select with short value="text"', () => {
    act(() => {
      root.render(<OibSelect
        name="name"
        label="label"
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
        valid={minLength(10)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
