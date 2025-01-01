import React from "react"

/* eslint-disable react/jsx-pascal-case */
import {
  BackgroundLayout,
  SEO,
  Header,
  Intro,
  ScrollPrompt,
  About,
  Skills,
  Projects,
  ScrollTop,
} from "../components"

export default function Home() {
  return (
    <>
      <SEO title="Home" />
      <BackgroundLayout>
        <Header />
        <Intro />
        <ScrollPrompt />
        <About />
        <Skills />
        <Projects />
        <ScrollTop />
      </BackgroundLayout>
    </>
  )
}
/* eslint-enable react/jsx-pascal-case */