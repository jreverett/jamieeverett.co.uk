import React from "react"
import { Helmet } from "react-helmet"

import { Header } from "../components"
import RedInk from "../files/RedInk-v3.mp4"
import "./index.css"

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Jamie Everett - Portfolio & Blog</title>
      </Helmet>

      <Header />
      <video className="welcome-video" autoPlay muted playsInline>
        <source src={RedInk}></source>
      </video>
      <div className="welcome">
        <p className="welcome-info">
          <span className="welcome-dropcap">Hi,</span> I'm a full stack
          computing graduate who loves to create awesome user experiences
        </p>
      </div>
      <section>
        {/* About Me */}
        here
      </section>
      <section>
        {/* Personal Projects */}
        {/* CSS mosaic? */}
      </section>
      <section>{/* Contact Me */}</section>
    </>
  )
}
