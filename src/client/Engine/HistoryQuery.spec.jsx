/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import HistoryQuery from './HistoryQuery.jsx'

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

describe('HistoryQuery', () => {
  test('check HistoryQuery', () => {
    act(() => {
      ReactDOM.render(<HistoryQuery
        historyQuery={testConfig.engine.historyQuery}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change folder', () => {
    act(() => {
      ReactDOM.render(<HistoryQuery
        historyQuery={testConfig.engine.historyQuery}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.historyQuery.folder'), { target: { value: './newFolder' } })
    expect(onChange).toBeCalledWith('engine.historyQuery.folder', './newFolder', null)
    expect(container).toMatchSnapshot()
  })
})
