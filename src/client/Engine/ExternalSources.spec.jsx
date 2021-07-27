/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import ExternalSources from './ExternalSources.jsx'

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

describe('ExternalSources', () => {
  test('check ExternalSources', () => {
    act(() => {
      ReactDOM.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change line', () => {
    act(() => {
      ReactDOM.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />, container)
    })
    Simulate.change(document.querySelector('td input'), { target: { value: 'newSource' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.externalSources.0', value: 'newSource', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check delete ExternalSources', () => {
    act(() => {
      ReactDOM.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />, container)
    })
    Simulate.click(document.querySelector('td path'))
    Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.externalSources.0' })
    expect(container).toMatchSnapshot()
  })
  test('check add line', () => {
    act(() => {
      ReactDOM.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />, container)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'engine.externalSources', value: '' })
    expect(container).toMatchSnapshot()
  })
})
