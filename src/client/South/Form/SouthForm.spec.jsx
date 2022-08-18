/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../../tests/testConfig.js'
import SouthForm from './SouthForm.jsx'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: jest.fn().mockReturnValue({ id: 'datasource-uuid-1' }),
}))

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig })

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

describe('SouthForm', () => {
  testConfig.south.dataSources.forEach((dataSource) => {
    test(`check SouthForm with dataSource: ${dataSource.name}`, () => {
      act(() => {
        root.render(
          <SouthForm dataSource={dataSource} dataSourceIndex={0} onChange={() => 1} />,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })
  test('check SouthForm with empty dataSource', () => {
    act(() => {
      root.render(
        <SouthForm dataSource={{ protocol: 'MQTT', name: 'emptyDataSource' }} dataSourceIndex={0} onChange={() => 1} />,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
