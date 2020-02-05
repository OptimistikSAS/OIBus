import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import ScanModes from './ScanModes.jsx'

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

describe('ScanModes', () => {
  test('check ScanModes', () => {
    act(() => {
      ReactDOM.render(<ScanModes
        scanModes={testConfig.engine.scanModes}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
