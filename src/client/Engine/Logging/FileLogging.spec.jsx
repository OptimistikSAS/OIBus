/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../../tests/testConfig'
import FileLogging from './FileLogging.jsx'

const onChange = jest.fn()

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

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

describe('FileLogging', () => {
  test('check FileLogging', () => {
    act(() => {
      root.render(<FileLogging
        logParameters={testConfig.engine.logParameters.fileLog}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change file level to "warning"', () => {
    act(() => {
      root.render(<FileLogging
        logParameters={testConfig.engine.logParameters.fileLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.fileLog.level'), { target: { value: 'warning', selectedIndex: 4 } })
    expect(onChange).toBeCalledWith('engine.logParameters.fileLog.level', 'error', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change file name to "new_filename"', () => {
    act(() => {
      root.render(<FileLogging
        logParameters={testConfig.engine.logParameters.fileLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.fileLog.fileName'), { target: { value: 'new_filename' } })
    expect(onChange).toBeCalledWith('engine.logParameters.fileLog.fileName', 'new_filename', null)
    expect(container).toMatchSnapshot()
  })
  test('check change fileLog maxSize 1000', () => {
    act(() => {
      root.render(<FileLogging
        logParameters={testConfig.engine.logParameters.fileLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.fileLog.maxSize'), { target: { value: 90000 } })
    expect(onChange).toBeCalledWith('engine.logParameters.fileLog.maxSize', 90000, null)
    expect(container).toMatchSnapshot()
  })
  test('check change fileLog numberOfFiles to 1', () => {
    act(() => {
      root.render(<FileLogging
        logParameters={testConfig.engine.logParameters.fileLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.fileLog.numberOfFiles'), { target: { value: 1 } })
    expect(onChange).toBeCalledWith('engine.logParameters.fileLog.numberOfFiles', 1, null)
    expect(container).toMatchSnapshot()
  })
  test('check change fileLog tailable to false', () => {
    act(() => {
      root.render(<FileLogging
        logParameters={testConfig.engine.logParameters.fileLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.fileLog.tailable'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.logParameters.fileLog.tailable', false, null)
    expect(container).toMatchSnapshot()
  })
})
