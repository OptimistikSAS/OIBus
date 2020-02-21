import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import NewApplicationRow from './NewApplicationRow.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('NewApplicationRow', () => {
  test('check NewApplicationRow', () => {
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={() => (1)}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
