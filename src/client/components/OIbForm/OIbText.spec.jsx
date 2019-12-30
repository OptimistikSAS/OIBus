import React from 'react'
import Enzyme, { shallow } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

import OIbText from './OIbText.jsx'
import { minLength } from '../../../services/validation.service'

Enzyme.configure({ adapter: new Adapter() })

describe('OIbText', () => {
  test('check Texte with value="a text"', () => {
    const wrapper = shallow(
      <OIbText
        label="label"
        value="a text"
        name="name"
        onChange={() => (1)}
        defaultValue="default text"
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
  test('check Texte with too short value', () => {
    const wrapper = shallow(
      <OIbText
        label="label"
        name="name"
        onChange={() => (1)}
        value="a text"
        valid={minLength(10)}
        defaultValue="default text"
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
  test('check Texte with inline', () => {
    const wrapper = shallow(
      <OIbText
        label="label"
        name="name"
        onChange={() => (1)}
        value="a text"
        defaultValue="default text"
        inline
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
})
