import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import NewDataSourceRow from './NewDataSourceRow.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('NewDataSourceRow', () => {
  test('check NewDataSourceRow', () => {
    act(() => {
      ReactDOM.render(
        <NewDataSourceRow
          protocolList={testConfig.protocolList}
          addDataSource={() => (1)}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
