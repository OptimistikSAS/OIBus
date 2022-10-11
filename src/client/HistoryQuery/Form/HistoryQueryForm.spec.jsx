/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testHistoryConfig } from '../../../../tests/testConfig'
import HistoryQueryForm from './HistoryQueryForm.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig: testHistoryConfig })
jest.mock('react-router-dom', () => (
  { useNavigate: jest.fn().mockReturnValue({}) }
))
global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}
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

describe('HistoryQueryForm', () => {
  testHistoryConfig.forEach((historyQuery) => {
    test(`check HistoryQueryForm with data: ${historyQuery.name}`, () => {
      act(() => {
        root.render(
          <HistoryQueryForm
            query={historyQuery}
          />,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })

  test('check HistoryQueryForm with empty North', () => {
    act(() => {
      root.render(
        <HistoryQueryForm
          query={{
            id: 'unique-id',
            name: 'north -> south',
            enabled: false,
            status: 'pending',
            southId: 'southId',
            northId: 'northId',
            query: '',
            order: 1,
            settings: {},
          }}
        />,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
