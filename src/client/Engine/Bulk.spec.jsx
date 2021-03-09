import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import Bulk from './Bulk.jsx'

const onChange = jest.fn()

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

describe('Bulk', () => {
  test('check Bulk', () => {
    act(() => {
      ReactDOM.render(<Bulk
        bulk={testConfig.engine.bulk}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change bulkFolder', () => {
    act(() => {
      ReactDOM.render(<Bulk
        bulk={testConfig.engine.bulk}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.bulk.bulkFolder'), { target: { value: './newFolder' } })
    expect(onChange).toBeCalledWith('engine.bulk.bulkFolder', './newFolder', null)
    expect(container).toMatchSnapshot()
  })
})
