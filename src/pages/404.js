/*
    Header
    404 number (knockout style)
    Footer?
*/

import React from "react"
import { Link } from "gatsby"

import { Header } from "../components"

export default function NotFound() {
  return (
    <div>
      <Header />
      <h1>404</h1>
      <p>
        Page not found,{" "}
        <Link to="/">
          head back home{" "}
          <span role="img" aria-label="House emoji">
            🏡
          </span>
        </Link>
      </p>
    </div>
  )
}
