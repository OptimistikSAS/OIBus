/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OIbText from './OIbText.jsx'
import { minLength } from '../../../services/validation.service'

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

describe('OIbText', () => {
  test('check Texte with value="a text"', () => {
    act(() => {
      root.render(<OIbText
        label="label"
        value="a text"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Texte with too short value', () => {
    act(() => {
      root.render(<OIbText
        label="label"
        name="name"
        onChange={() => (1)}
        value="a text"
        valid={minLength(10)}
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Texte with inline', () => {
    act(() => {
      root.render(<OIbText
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
})
