/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbTitle from './OIbTitle.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbTitle', () => {
  test('check Title with no children', () => {
    act(() => {
      ReactDOM.render(<OIbTitle
        label="a title"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
