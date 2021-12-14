/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../../tests/testConfig'
import SouthForm from './SouthForm.jsx'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: jest.fn().mockReturnValue({ id: 'datasource-uuid-1' }),
}))

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig })

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

describe('SouthForm', () => {
  newConfig.south.dataSources.forEach((dataSource) => {
    test(`check SouthForm with dataSource: ${dataSource.name}`, () => {
      act(() => {
        ReactDOM.render(
          <SouthForm dataSource={dataSource} dataSourceIndex={0} onChange={() => 1} />,
          container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })
  test('check SouthForm with empty dataSource', () => {
    act(() => {
      ReactDOM.render(
        <SouthForm dataSource={{ protocol: 'MQTT', name: 'emptyDataSource' }} dataSourceIndex={0} onChange={() => 1} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
