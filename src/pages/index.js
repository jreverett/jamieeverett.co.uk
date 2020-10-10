import React from "react"

import {
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
