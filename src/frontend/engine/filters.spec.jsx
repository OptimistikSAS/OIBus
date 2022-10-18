/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/test-config'
import Filters from './filters.jsx'

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

const dispatchNewConfig = jest.fn()
// replace useContext to return a mock of dispatchNewConfig()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})
describe('Filters', () => {
  test('check Filters', () => {
    act(() => {
      root.render(<Filters
        filters={testConfig.engine.filter}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change line', () => {
    act(() => {
      root.render(<Filters
        filters={testConfig.engine.filter}
      />)
    })
    Simulate.change(document.querySelector('td input'), { target: { value: '2.2.2.2' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.filter.0', value: '2.2.2.2', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check delete Filter', () => {
    act(() => {
      root.render(<Filters
        filters={testConfig.engine.filter}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('td path'))
    })

    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.filter.0' })

    expect(container).toMatchSnapshot()
  })
  test('check add line', () => {
    act(() => {
      root.render(<Filters
        filters={testConfig.engine.filter}
      />)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'engine.filter', value: '' })
    expect(container).toMatchSnapshot()
  })
})
