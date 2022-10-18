/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibTextArea from './oib-text-area.jsx'
import { minLength } from '../../../service/validation.service'

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

describe('OIbTextArea', () => {
  test('check TextArea with value="some text in the area"', () => {
    act(() => {
      root.render(<OibTextArea
        label="label"
        value="some text in the area"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TextArea with value="some text" and no label', () => {
    act(() => {
      root.render(<OibTextArea
        value="some text"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TextArea with value and help text', () => {
    act(() => {
      root.render(<OibTextArea
        label="label"
        value="some text in the area"
        help={<div>some help text</div>}
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TextArea with too short value', () => {
    act(() => {
      root.render(<OibTextArea
        label="label"
        name="name"
        onChange={() => (1)}
        value="short text"
        valid={minLength(10)}
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TextArea with inline', () => {
    act(() => {
      root.render(<OibTextArea
        label="label"
        name="name"
        onChange={() => (1)}
        value="a text"
        defaultValue="default text"
        inline
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TextArea no value', () => {
    act(() => {
      root.render(<OibTextArea
        label="label"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
        inline
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change text', () => {
    const onChange = jest.fn()
    const valid = jest.fn()
    act(() => {
      root.render(<OibTextArea
        label="label"
        name="name"
        onChange={onChange}
        value="a text"
        defaultValue="default text"
        valid={valid}
        inline
      />)
    })
    Simulate.change(document.getElementById('name'), { target: { value: 'new_text' } })
    expect(onChange).toBeCalledWith('name', 'new_text', valid('new_text'))
    expect(container).toMatchSnapshot()
  })
})
