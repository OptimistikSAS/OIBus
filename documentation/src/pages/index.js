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
        <h1 className={clsx('hero__title', styles.welcomeTitle)}>{siteConfig.title}</h1>
        <p className={clsx('hero__subtitle', styles.welcomeTitle)}>{siteConfig.tagline}</p>
        <div className="row">
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <Link
                className={clsx('button button--secondary button--md', styles.welcomeButtons)}
                style={{ marginTop: '1em', marginBottom: '1em', color: '#f5f5f5' }}
                to="/docs/guide"
              >
                Get familiar with OIBus
              </Link>
            </div>
          </div>
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <Link
                className={clsx('button button--secondary button--md', styles.welcomeButtons)}
                style={{ marginLeft: '2em', marginRight: '2em', marginTop: '1em', marginBottom: '1em', color: '#f5f5f5' }}
                to="/docs/guide/installation"
              >
                Install OIBus
              </Link>
            </div>
          </div>
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <Link
                className={clsx('button button--secondary button--md', styles.welcomeButtons)}
                style={{ marginTop: '1em', marginBottom: '1em', color: '#f5f5f5' }}
                to="/docs/developer"
              >
                Develop OIBus
              </Link>
            </div>
          </div>
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
