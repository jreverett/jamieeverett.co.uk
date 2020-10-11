import React from "react"
import { Helmet } from "react-helmet"
import { Link, StaticQuery, graphql } from "gatsby"

import CV from "../../assets/docs/CV.pdf"
import "./Header.css"

export default function Header() {
  return (
    <StaticQuery
      query={graphql`
        query HeaderQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `}
      render={data => (
        <>
          <Helmet>
            <html lang="en" />
            <title>{data.site.siteMetadata.title}</title>
          </Helmet>
          <div className="header-wrapper">
            <div className="header">
              <div className="header-home-button">
                <Link to="/">jamie everett</Link>
              </div>
              <nav>
                <a href={CV} target="_blank" rel="noopener noreferrer">
                  CV
                </a>
                <Link to="/blog">Blog</Link>
                <a href="/#contact">Contact</a>
              </nav>
            </div>
          </div>
        </>
      )}
    />
  )
}
