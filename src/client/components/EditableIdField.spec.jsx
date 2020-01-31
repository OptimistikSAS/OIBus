import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import EditableIdField from './EditableIdField.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('EditableIdField', () => {
  test('check Alert', () => {
    act(() => {
      ReactDOM.render(<EditableIdField
        id="id"
        fromList={[{ test: 'test' }]}
        index={1}
        name="name"
        idChanged={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
