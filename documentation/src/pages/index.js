import React from 'react'
import clsx from 'clsx'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Layout from '@theme/Layout'
import HomepageFeatures from '@site/src/components/HomepageFeatures'

import styles from './index.module.css'

const HomepageHeader = () => {
  const { siteConfig } = useDocusaurusContext()
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/guide"
          >
            Get familiar with OIBus
          </Link>
          <Link
            className="button button--secondary button--lg"
            style={{ marginLeft: '2em' }}
            to="/docs/guide/installation"
          >
            Install OIBus
          </Link>
          <Link
            className="button button--secondary button--lg"
            style={{ marginLeft: '2em' }}
            to="/docs/developer"
          >
            Develop OIBus
          </Link>
        </div>
      </div>
    </header>
  )
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout
      title={`${siteConfig.title} - Documentation`}
      description="Documentation for OIBus, an open-source data extraction tool"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  )
}
