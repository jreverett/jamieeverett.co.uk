import React from "react"

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
