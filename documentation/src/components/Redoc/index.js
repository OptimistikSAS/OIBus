import React from 'react';
import Redoc from '@theme/Redoc';
import PropTypes from 'prop-types';

import styles from './styles.module.css';

export default function RedocWrapper({ spec }) {
  return (
    <div className={styles.redocContainer}>
      <Redoc spec={spec} />
    </div>
  );
}

RedocWrapper.propTypes = {
  spec: PropTypes.object.isRequired
};
