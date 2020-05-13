import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import Filters from './Filters.jsx'

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

const dispatchNewConfig = jest.fn()
// replace useContext to return a mock of dispatchNewConfig()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('Filters', () => {
  test('check Filters', () => {
    act(() => {
      ReactDOM.render(<Filters
        filters={testConfig.engine.filter}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change line', () => {
    act(() => {
      ReactDOM.render(<Filters
        filters={testConfig.engine.filter}
      />, container)
    })
    Simulate.change(document.querySelector('td input'), { target: { value: '2.2.2.2' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.filter.0', value: '2.2.2.2', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check delete Filter', () => {
    act(() => {
      ReactDOM.render(<Filters
        filters={testConfig.engine.filter}
      />, container)
    })
    Simulate.click(document.querySelector('td path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.filter.0' })
    expect(container).toMatchSnapshot()
  })
  test('check add line', () => {
    act(() => {
      ReactDOM.render(<Filters
        filters={testConfig.engine.filter}
      />, container)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'engine.filter', value: '' })
    expect(container).toMatchSnapshot()
  })
})
