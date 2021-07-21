/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbSelect from './OIbSelect.jsx'
import { minLength } from '../../../services/validation.service'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbSelect', () => {
  test('check Select with value="some text"', () => {
    act(() => {
      ReactDOM.render(<OIbSelect
        name="name"
        label="label"
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Select with value="some text" and no label', () => {
    act(() => {
      ReactDOM.render(<OIbSelect
        name="name"
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Select with value="some text" and help', () => {
    act(() => {
      ReactDOM.render(<OIbSelect
        name="name"
        label="label"
        help={<div>helpt text</div>}
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Select with short value="text"', () => {
    act(() => {
      ReactDOM.render(<OIbSelect
        name="name"
        label="label"
        onChange={() => (1)}
        options={['option1', 'option2']}
        value="some text"
        defaultValue="default text"
        valid={minLength(10)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
