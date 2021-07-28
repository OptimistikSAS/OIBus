/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import Caching from './Caching.jsx'

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

describe('Caching', () => {
  test('check Caching', () => {
    act(() => {
      ReactDOM.render(<Caching
        caching={testConfig.engine.caching}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change cacheFolder', () => {
    act(() => {
      ReactDOM.render(<Caching
        caching={testConfig.engine.caching}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.caching.cacheFolder'), { target: { value: './newFolder' } })
    expect(onChange).toBeCalledWith('engine.caching.cacheFolder', './newFolder', null)
    expect(container).toMatchSnapshot()
  })
  test('check change archiveFolder', () => {
    act(() => {
      ReactDOM.render(<Caching
        caching={testConfig.engine.caching}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.caching.archive.archiveFolder'), { target: { value: './newArchiveFolder' } })
    expect(onChange).toBeCalledWith('engine.caching.archive.archiveFolder', './newArchiveFolder', null)
    expect(container).toMatchSnapshot()
  })
  test('check change archiveMode to "archive"', () => {
    act(() => {
      ReactDOM.render(<Caching
        caching={testConfig.engine.caching}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.caching.archive.enabled'), { target: { checked: true } })
    expect(onChange).toBeCalledWith('engine.caching.archive.enabled', true, null)
    expect(container).toMatchSnapshot()
  })
})
