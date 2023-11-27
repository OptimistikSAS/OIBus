import React from 'react'
import clsx from 'clsx'
import styles from './styles.module.css'
import Translate from "@docusaurus/Translate";

const FeatureList = [
  {
    title: 'Multi source',
    Svg: require('@site/static/img/multi-source.svg').default,
    description: (
      <>
        <Translate description="Multi source feature">
          Access a variety of data sources securely and remotely, including databases and IoT devices.
        </Translate>
      </>
    ),
  },
  {
    title: 'No code',
    Svg: require('@site/static/img/no-code.svg').default,
    description: (
      <>
        <Translate description="No code feature">
          Using OIBus is simple: connect a data source and send your data at desired intervals directly from the web interface.
        </Translate>
      </>
    ),
  },
  {
    title: 'Real time',
    Svg: require('@site/static/img/real-time.svg').default,
    description: (
      <Translate description="Real time feature">
        Manage your subscriptions and schedule tasks with high precision to adapt your data stream to your real-time
        needs.
      </Translate>
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
