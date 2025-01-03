import React from "react"
import { Link } from "gatsby"

import CV from "../../assets/docs/CV.pdf"
import "./Header.css"

export default function Header() {
  return (
    <div className="header-wrapper">
      <div className="header">
        <div className="header-home-button">
          <Link to="/">jamie everett</Link>
        </div>
        <nav>
          <a href={CV} target="_blank" rel="noopener noreferrer">
            CV
          </a>
        </nav>
      </div>
    </div>
  )
}
