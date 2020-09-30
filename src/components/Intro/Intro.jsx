import React from "react"

import RedInk from "../../files/RedInk-v3.mp4"
import "./Intro.css"

export default function Intro() {
  return (
    <section id="intro">
      <video className="intro-video" autoPlay muted playsInline>
        <source src={RedInk}></source>
      </video>
      <div className="intro-text-container">
        <p className="intro-text">
          <span className="intro-text-dropcap">Hi,</span> I'm a full stack
          computing graduate who loves to create awesome user experiences
        </p>
      </div>
    </section>
  )
}
