/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { BrowserRouter } from 'react-router-dom'

import newConfig from '../../../../tests/testConfig'
import SouthForm from './SouthForm.jsx'

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
    test(`check SouthForm with dataSource: ${dataSource.dataSourceId}`, () => {
      act(() => {
        ReactDOM.render(
          <BrowserRouter>
            <SouthForm dataSource={dataSource} dataSourceIndex={0} onChange={() => 1} />
          </BrowserRouter>,
          container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })
  test('check SouthForm with empty dataSource', () => {
    act(() => {
      ReactDOM.render(
        <BrowserRouter>
          <SouthForm dataSource={{ protocol: 'MQTT' }} dataSourceIndex={0} onChange={() => 1} />
        </BrowserRouter>,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
