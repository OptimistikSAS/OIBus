import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import styles from "./index.module.css";
import Translate from "@docusaurus/Translate";

const HomepageHeader = () => {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className={clsx('hero__title', styles.welcomeTitle)}>
          <Translate description="The homepage main heading">
            OIBus - Data collection solution
          </Translate>
        </h1>
        <p className={clsx('hero__subtitle', styles.welcomeTitle)}>
          <Translate description="The tagline">
            Start collecting your data now
          </Translate>
        </p>
        <div className="row">
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <Link
                className={clsx('button button--secondary button--md', styles.welcomeButtons)}
                style={{ marginTop: '1em', marginBottom: '1em', color: '#f5f5f5' }}
                to="/docs/guide/"
              >
                <Translate description="The guide button">
                  Get familiar with OIBus
                </Translate>
              </Link>
            </div>
          </div>
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <Link
                className={clsx('button button--secondary button--md', styles.welcomeButtons)}
                style={{ marginLeft: '2em', marginRight: '2em', marginTop: '1em', marginBottom: '1em', color: '#f5f5f5' }}
                to="/docs/guide/installation/"
              >
                <Translate description="The install button">
                  Install OIBus
                </Translate>
              </Link>
            </div>
          </div>
          <div className={clsx('col col--4')}>
            <div className="text--center">
              <Link
                className={clsx('button button--secondary button--md', styles.welcomeButtons)}
                style={{ marginTop: '1em', marginBottom: '1em', color: '#f5f5f5' }}
                to="/docs/developer/"
              >
                <Translate description="The develop button">
                  Develop OIBus
                </Translate>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function Home() {
  return (
    <Layout
      title={`OIBus - Data collection solution - Documentation`}
      description="Documentation for OIBus, an open-source data extraction tool"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  )
}
