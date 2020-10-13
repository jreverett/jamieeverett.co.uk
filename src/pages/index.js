import React from "react"

import {
  SEO,
  Header,
  Intro,
  ScrollPrompt,
  About,
  Skills,
  Projects,
  ScrollTop,
} from "../components"
import "./index.css"

export default function Home() {
  return (
    <>
      <SEO />
      <Header />
      <Intro />
      <ScrollPrompt />
      <About />
      <Skills />
      <Projects />
      <ScrollTop />
    </>
  )
}
