import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbTextArea from './OIbTextArea.jsx'
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

describe('OIbTextArea', () => {
  test('check TexteArea with value="some text in the area"', () => {
    act(() => {
      ReactDOM.render(<OIbTextArea
        label="label"
        value="some text in the area"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TexteArea with value="some text" and no label', () => {
    act(() => {
      ReactDOM.render(<OIbTextArea
        value="some text"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TexteArea with value and help text', () => {
    act(() => {
      ReactDOM.render(<OIbTextArea
        label="label"
        value="some text in the area"
        help={<div>some help text</div>}
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check TexteArea with too short value', () => {
    act(() => {
      ReactDOM.render(<OIbTextArea
        label="label"
        name="name"
        onChange={() => (1)}
        value="short text"
        valid={minLength(10)}
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Texte with inline', () => {
    act(() => {
      ReactDOM.render(<OIbTextArea
        label="label"
        name="name"
        onChange={() => (1)}
        value="a text"
        defaultValue="default text"
        inline
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
