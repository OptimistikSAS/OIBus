/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig'
import ExternalSources from './ExternalSources.jsx'

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

describe('ExternalSources', () => {
  test('check ExternalSources', () => {
    act(() => {
      root.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change line', () => {
    act(() => {
      root.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />)
    })
    Simulate.change(document.querySelector('td input'), { target: { value: 'newSource' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.externalSources.0', value: 'newSource', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check delete ExternalSources', () => {
    act(() => {
      root.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('td path'))
    })

    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.externalSources.0' })
    expect(container).toMatchSnapshot()
  })
  test('check add line', () => {
    act(() => {
      root.render(<ExternalSources
        externalSources={testConfig.engine.externalSources}
      />)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'engine.externalSources', value: '' })
    expect(container).toMatchSnapshot()
  })
})
