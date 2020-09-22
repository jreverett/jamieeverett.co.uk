import React from "react"
import { Link } from "gatsby"

import CV from "../files/CV.pdf"
import "./Header.css"

export default function Header() {
  return (
    <div className="header-wrapper">
      <div className="header">
        <div className="header-home-button">
          <Link to="/">Jamie Everett</Link>
        </div>
        <nav>
          <a href={CV} target="_blank" rel="noopener noreferrer">
            CV
          </a>
          <Link to="/blog">Blog</Link>
        </nav>
      </div>
    </div>
  )
}
