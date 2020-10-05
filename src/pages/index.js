import React from "react"
import { Helmet } from "react-helmet"

import {
  Header,
  Intro,
  About,
  Skills,
  Projects,
  Contact,
  ScrollTop,
} from "../components"
import "./index.css"

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Jamie Everett - Portfolio & Blog</title>
      </Helmet>
      <Header />
      <Intro />
      <About />
      <Skills />
      <Projects />
      <Contact />
      <ScrollTop />
    </>
  )
}
