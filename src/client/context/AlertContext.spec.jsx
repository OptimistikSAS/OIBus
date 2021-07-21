/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import { AlertProvider } from './AlertContext.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('AlertProvider', () => {
  test('check AlertProvider', () => {
    act(() => {
      ReactDOM.render(
        <AlertProvider>
          <div />
        </AlertProvider>,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
