/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig'
import HistoryQuery from './HistoryQuery.jsx'

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

describe('HistoryQuery', () => {
  test('check HistoryQuery', () => {
    act(() => {
      root.render(<HistoryQuery
        historyQuery={testConfig.engine.historyQuery}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change folder', () => {
    act(() => {
      root.render(<HistoryQuery
        historyQuery={testConfig.engine.historyQuery}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.historyQuery.folder'), { target: { value: './newFolder' } })
    expect(onChange).toBeCalledWith('engine.historyQuery.folder', './newFolder', null)
    expect(container).toMatchSnapshot()
  })
})
