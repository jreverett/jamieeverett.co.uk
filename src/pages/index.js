import React from "react"

/* eslint-disable react/jsx-pascal-case */
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
      <SEO title="Home" />
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
/* eslint-enable react/jsx-pascal-case */