import React from "react"
import { Link } from "gatsby"

import { FluidBackground } from "../components"
import "./404.css"

export default function NotFound() {
  return (
    <>
      <FluidBackground />
      <div className="not-found-page">
        <div className="not-found-card">
          <div className="glow-line" />
          <h1 className="not-found-number">404</h1>
          <p className="not-found-message">Page not found</p>
          <Link to="/" className="not-found-link">
            Back to home
          </Link>
        </div>
      </div>
    </>
  )
}

export const Head = () => <title>Page not found | Jamie Everett</title>
