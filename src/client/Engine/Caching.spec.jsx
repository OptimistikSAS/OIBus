/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig'
import Caching from './Caching.jsx'

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

describe('Caching', () => {
  test('check Caching', () => {
    act(() => {
      root.render(<Caching
        caching={testConfig.engine.caching}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change cacheFolder', () => {
    act(() => {
      root.render(<Caching
        caching={testConfig.engine.caching}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.caching.cacheFolder'), { target: { value: './newFolder' } })
    expect(onChange).toBeCalledWith('engine.caching.cacheFolder', './newFolder', null)
    expect(container).toMatchSnapshot()
  })
  test('check change archiveFolder', () => {
    act(() => {
      root.render(<Caching
        caching={testConfig.engine.caching}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.caching.archive.archiveFolder'), { target: { value: './newArchiveFolder' } })
    expect(onChange).toBeCalledWith('engine.caching.archive.archiveFolder', './newArchiveFolder', null)
    expect(container).toMatchSnapshot()
  })
  test('check change archiveMode to "archive"', () => {
    act(() => {
      root.render(<Caching
        caching={testConfig.engine.caching}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.caching.archive.enabled'), { target: { checked: true } })
    expect(onChange).toBeCalledWith('engine.caching.archive.enabled', true, null)
    expect(container).toMatchSnapshot()
  })
})
