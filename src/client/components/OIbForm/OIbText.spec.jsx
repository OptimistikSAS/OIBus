/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbText from './OIbText.jsx'
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

describe('OIbText', () => {
  test('check Texte with value="a text"', () => {
    act(() => {
      ReactDOM.render(<OIbText
        label="label"
        value="a text"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Texte with too short value', () => {
    act(() => {
      ReactDOM.render(<OIbText
        label="label"
        name="name"
        onChange={() => (1)}
        value="a text"
        valid={minLength(10)}
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Texte with inline', () => {
    act(() => {
      ReactDOM.render(<OIbText
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
