import React from 'react'
import Enzyme, { shallow } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

import OIbInteger from './OIbInteger.jsx'
import { minValue } from '../../../services/validation.service'

Enzyme.configure({ adapter: new Adapter() })

describe('OIbInteger', () => {
  test('check OIbInteger with value="a text"', () => {
    const wrapper = shallow(
      <OIbInteger
        label="label"
        value="12345678"
        name="name"
        onChange={() => (1)}
        defaultValue="0"
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
  test('check Texte with too small value', () => {
    const wrapper = shallow(
      <OIbInteger
        label="label"
        name="name"
        onChange={() => (1)}
        value="12"
        valid={minValue(100)}
        defaultValue="0"
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
})
