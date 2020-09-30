import React from "react"
import { Helmet } from "react-helmet"

import { Header, Intro, About, Contact } from "../components"
import "./index.css"

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Jamie Everett - Portfolio & Blog</title>
      </Helmet>
      <Header />
      <Intro />
      <About /> {/* Another animation here, react-scroll-trigger? */}
      {/* Personal Projects, css mosaic(?) */}
      {/* <Contact /> */}
      <Contact />
    </>
  )
}
