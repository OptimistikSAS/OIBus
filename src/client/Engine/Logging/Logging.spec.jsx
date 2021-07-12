import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../../tests/testConfig'
import Logging from './Logging.jsx'

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('Logging', () => {
  test('check Logging', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
