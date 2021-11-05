import React from 'react'
import PropTypes from 'prop-types'
import { ConfigProvider } from './configContext.jsx'
import { HistoryConfigProvider } from './historyContext.jsx'

const ConfigProviders = ({ children }) => (
  <ConfigProvider>
    <HistoryConfigProvider>
      {children}
    </HistoryConfigProvider>
  </ConfigProvider>
)

ConfigProviders.propTypes = { children: PropTypes.element.isRequired }
export default ConfigProviders
