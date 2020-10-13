import React, { useRef } from "react"
import { Waypoint } from "react-waypoint"

import InkAnimation from "../../assets/videos/blue-pink-ink-v4-compressed.mp4"
import CV from "../../assets/docs/CV.pdf"
import "./About.css"

export default function About() {
  const aboutVideoRef = useRef(null)
  let videoHasPlayed = false

  function handleWaypointEnter() {
    if (!videoHasPlayed) aboutVideoRef.current.play()
    videoHasPlayed = true
  }

  return (
    <Waypoint onEnter={handleWaypointEnter}>
      <section id="about">
        <video ref={aboutVideoRef} className="about-video" muted playsInline>
          <source src={InkAnimation}></source>
        </video>
        <div className="about-text-container">
          <h1>About</h1>
          <p>
            I'm a computing graduate in the{" "}
            <a
              href="https://goo.gl/maps/XmPcWCetS6GYZrgk7"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bristol area.
            </a>
          </p>
          <p>
            I graduated this year with first class honours from the University
            of Plymouth studying BSc (Hons.) Computing,{" "}
            <a href={CV} target="_blank" rel="noopener noreferrer">
              more on that here
            </a>
            .
          </p>
          <p>
            Having finished my degree, I am looking for a developer position in
            the Bristol/Bath area.
          </p>
          <p>
            Feel free to browse some of my work below and get in touch through{" "}
            <a
              href="https://github.com/jreverett"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            ,{" "}
            <a
              href="https://www.linkedin.com/in/jamie-everett-135755153/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>{" "}
            or email me at{" "}
            <a href="mailto:jreverett2442@gmail.com">jreverett2442@gmail.com</a>
            !
          </p>
        </div>
      </section>
    </Waypoint>
  )
}
