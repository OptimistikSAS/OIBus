/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../../tests/testConfig.js'
import NorthForm from './NorthForm.jsx'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: jest.fn().mockReturnValue({ id: 'north-id' }),
}))

React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig })

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

describe('NorthForm', () => {
  testConfig.north.applications.forEach((application) => {
    test(`check NorthForm with application: ${application.name}`, () => {
      act(() => {
        root.render(
          <NorthForm application={application} applicationIndex={0} onChange={() => 1} />,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })

  test('check NorthForm with empty application', () => {
    act(() => {
      root.render(
        <NorthForm application={{ api: 'Console', name: 'emptyApplication' }} applicationIndex={0} onChange={() => 1} />,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
