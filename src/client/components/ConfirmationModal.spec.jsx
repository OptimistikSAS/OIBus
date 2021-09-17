/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import ConfirmationModal from './ConfirmationModal.jsx'

import activeConfig from '../../../tests/testConfig'

const mockHistoryPush = jest.fn()

jest.mock('react-router-dom', () => (
  { useHistory: () => ({ push: mockHistoryPush }) }
))

let container

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  jest.clearAllMocks()
})

React.useContext = jest.fn().mockReturnValue({ activeConfig })
describe('ConfirmationModal', () => {
  test('display ConfirmationModal page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <ConfirmationModal title="My Title" body="My Body" onConfirm={() => true} isOpen={false} toggle={() => true} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
