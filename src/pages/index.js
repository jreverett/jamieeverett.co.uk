import React from "react"

import {
  SEO,
  Header,
  Intro,
  ScrollPrompt,
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
      <SEO title="Home" />
      <Header />
      <Intro />
      <ScrollPrompt />
      <About />
      <Skills />
      <Projects />
      <Contact />
      <ScrollTop />
    </>
  )
}
