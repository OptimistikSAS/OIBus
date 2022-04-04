/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { AlertProvider } from './AlertContext.jsx'

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

describe('AlertProvider', () => {
  test('check AlertProvider', () => {
    act(() => {
      root.render(
        <AlertProvider>
          <div />
        </AlertProvider>,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
