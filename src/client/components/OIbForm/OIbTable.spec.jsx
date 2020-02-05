import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbTable from './OIbTable.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbTable', () => {
  test('check Table with name, label and rows', () => {
    act(() => {
      ReactDOM.render(<OIbTable
        name="a name"
        label="a title"
        rows={{ value: 'value' }}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Table with help', () => {
    act(() => {
      ReactDOM.render(<OIbTable
        name="a name"
        label="a title"
        help={<div>help</div>}
        rows={{ value: 'value' }}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
