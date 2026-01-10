import React from "react"
import "./About.css"

export default function About() {
  return (
    <section id="about">
      <div className="about-text-container">
        <h1>About</h1>
        <p>
          I'm a senior software engineer in {" "}
          <a
            href="https://goo.gl/maps/VbZyJHhXb4CwRYxN9"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bristol, UK
          </a>
          , working for{" "}
          <a
            href="https://www.inductosense.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Inductosense
          </a>
          .
        </p>
        <p>
          I graduated from the University of Plymouth with first class honours, studying BSc (Hons.) Computing.
        </p>
        <p>
          I have since been working primarily as a .NET developer, spending my time on .NET development,
          Azure cloud, DevOps setups, and designing and managing projects that solve real-world problems.{" "}
          <a href="/cv.pdf" target="_blank" rel="noopener noreferrer">
            More on that here
          </a>
          .
        </p>
        <p>
          Feel free to browse some of my personal projects below and get in touch through{" "}
          <a
            href="https://github.com/jreverett"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub{" "}
          </a>
          or{" "}
          <a
            href="https://www.linkedin.com/in/jamie-everett-135755153/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn!
          </a>
        </p>
      </div>
    </section>
  )
}
