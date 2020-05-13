import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import Logging from './Logging.jsx'

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
  test('check change consoleLevel to "warning"', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.consoleLevel'), { target: { value: 'warning', selectedIndex: 3 } })
    expect(onChange).toBeCalledWith('engine.logParameters.consoleLevel', 'warning', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change fileLevel to "warning"', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.fileLevel'), { target: { value: 'warning', selectedIndex: 3 } })
    expect(onChange).toBeCalledWith('engine.logParameters.fileLevel', 'warning', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteLevell to "warning"', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteLevel'), { target: { value: 'warning', selectedIndex: 3 } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteLevel', 'warning', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change filename to "new_filename"', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.filename'), { target: { value: 'new_filename' } })
    expect(onChange).toBeCalledWith('engine.logParameters.filename', 'new_filename', null)
    expect(container).toMatchSnapshot()
  })
  test('check change maxsize 1000', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.maxsize'), { target: { value: 1000 } })
    expect(onChange).toBeCalledWith('engine.logParameters.maxsize', 1000, null)
    expect(container).toMatchSnapshot()
  })
  test('check change maxFiles to 1', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.maxFiles'), { target: { value: 1 } })
    expect(onChange).toBeCalledWith('engine.logParameters.maxFiles', 1, null)
    expect(container).toMatchSnapshot()
  })
  test('check change tailable to false', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.tailable'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.logParameters.tailable', false, null)
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteFilename to "new_sqliteFilename"', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteFilename'), { target: { value: 'new_sqliteFilename' } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteFilename', 'new_sqliteFilename', null)
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteMaxFileSize to 10000000', () => {
    act(() => {
      ReactDOM.render(<Logging
        logParameters={testConfig.engine.logParameters}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteMaxFileSize'), { target: { value: 10000000 } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteMaxFileSize', 10000000, null)
    expect(container).toMatchSnapshot()
  })
})
