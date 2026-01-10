import React from "react"
import { Link } from "gatsby"

import "./Header.css"

export default function Header() {
  return (
    <div className="header-wrapper">
      <div className="header">
        <div className="header-home-button">
          <Link to="/">jamie everett</Link>
        </div>
        <nav>
          <a href="/cv.pdf" target="_blank" rel="noopener noreferrer">
            CV
          </a>
        </nav>
      </div>
    </div>
  )
}
