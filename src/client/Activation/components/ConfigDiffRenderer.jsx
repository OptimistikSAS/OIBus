import React from 'react'
import { Label } from 'reactstrap'
import { PropTypes } from 'prop-types'
import Constants from '../../helpers/constants'

const ConfigDiffRenderer = ({ deltaHTML, diffError }) => (
  <div className="oi-full-width">
    {diffError ? <Label>{diffError}</Label> : null}
    {deltaHTML.length > Constants.MAX_DIFF_LENGTH ? (
      <Label>The configuration difference is too large to display</Label>
    ) : (
    // eslint-disable-next-line react/no-danger
      <div dangerouslySetInnerHTML={{ __html: deltaHTML }} />
    )}
  </div>
)

ConfigDiffRenderer.propTypes = {
  deltaHTML: PropTypes.string.isRequired,
  diffError: PropTypes.string,
}

ConfigDiffRenderer.defaultProps = { diffError: undefined }

export default ConfigDiffRenderer
