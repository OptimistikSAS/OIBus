/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../../tests/testHistoryConfig'
import HistoryQueryForm from './HistoryQueryForm.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })
jest.mock('react-router-dom', () => (
  { useNavigate: jest.fn().mockReturnValue({}) }
))
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

describe('HistoryQueryForm', () => {
  newConfig.forEach((historyQuery, index) => {
    test(`check HistoryQueryForm with data: ${historyQuery.name}`, () => {
      act(() => {
        ReactDOM.render(
          <HistoryQueryForm
            query={historyQuery}
            queryIndex={index}
            onChange={() => 1}
          />,
          container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })

  test('check HistoryQueryForm with empty application', () => {
    act(() => {
      ReactDOM.render(
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
          }}
          queryIndex={0}
          onChange={() => 1}
        />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
