/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { SchemaProvider } from './SchemaContext.jsx'

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

describe('SchemaProvider', () => {
  test('check SchemaProvider', () => {
    act(() => {
      root.render(
        <SchemaProvider>
          <div />
        </SchemaProvider>,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
