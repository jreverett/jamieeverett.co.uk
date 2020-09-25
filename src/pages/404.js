/*
    Header
    404 number (knockout style)
    Footer?
*/

import React from "react"
import { Link } from "gatsby"

import { Header } from "../components"
import AnimatedBackground from "../files/BlueGreenOil.mp4"
import BackgroundPoster from "../files/BlueGreenOil.png"
import "./404.css"

export default function NotFound() {
  return (
    <div>
      <Header />
      <video poster={BackgroundPoster} autoPlay muted playsInline loop>
        <source src={AnimatedBackground}></source>
      </video>
      <div className="e404-container">
        <p className="e404-number">404</p>
        <div className="e404-text">
          <p>
            Page not found, <Link to="/">head back home.</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
