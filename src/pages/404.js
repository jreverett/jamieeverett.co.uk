import React from "react"
import { Helmet } from "react-helmet"
import { Link } from "gatsby"

import { Header } from "../components"
import AnimatedBackground from "../assets/videos/blue-green-oil-v2.mp4"
import BackgroundPoster from "../assets/images/blue-green-oil.png"
import "./404.css"

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page not found</title>
      </Helmet>
      <div>
        <Header />
        <video
          className="e404-video"
          poster={BackgroundPoster}
          autoPlay
          muted
          playsInline
          loop
        >
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
    </>
  )
}