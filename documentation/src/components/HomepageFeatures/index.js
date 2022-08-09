import React from 'react'
import clsx from 'clsx'
import styles from './styles.module.css'

const FeatureList = [
  {
    title: 'Multi source',
    Svg: require('@site/static/img/multi-source.svg').default,
    description: (
      <>
        Access as many data sources that you have, when you want from databases to IoT and PLCs, securely and remotely.
      </>
    ),
  },
  {
    title: 'No code',
    Svg: require('@site/static/img/no-code.svg').default,
    description: (
      <>
        OIBus is easy to use: connect a data source, cache and send your data at specific intervals directly from
        its web interface.
      </>
    ),
  },
  {
    title: 'Real time',
    Svg: require('@site/static/img/real-time.svg').default,
    description: (
      <>
        With subscriptions management and high precision cron tasks, adapt your data stream to your real time needs.
      </>
    ),
  },
]

const Feature = ({ Svg, title, description }) => (
  <div className={clsx('col col--4')}>
    <div className="text--center">
      <Svg className={styles.featureImg} role="img" />
    </div>
    <div className="text--center padding-horiz--md">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </div>
)

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
