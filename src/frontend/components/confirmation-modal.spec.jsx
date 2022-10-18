/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import ConfirmationModal from './confirmation-modal.jsx'

import activeConfig from '../../../tests/test-config'

const mockHistoryPush = jest.fn()

jest.mock('react-router-dom', () => (
  { useHistory: () => ({ push: mockHistoryPush }) }
))

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

React.useContext = jest.fn().mockReturnValue({ activeConfig })
describe('ConfirmationModal', () => {
  test('display ConfirmationModal page based on config', async () => {
    act(() => {
      root.render(
        <ConfirmationModal title="My Title" body="My Body" onConfirm={() => true} isOpen={false} toggle={() => true} />,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
