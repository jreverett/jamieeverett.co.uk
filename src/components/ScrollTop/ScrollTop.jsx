import React, { useState } from "react"
import { RiArrowUpLine } from "react-icons/ri"

import "./ScrollTop.css"

export default function ScrollTop() {
  const [showScroll, setShowScroll] = useState(false)

  const checkScrollTop = () => {
    if (!showScroll && window.pageYOffset > 500) {
      setShowScroll(true)
    } else if (showScroll && window.pageYOffset <= 500) {
      setShowScroll(false)
    }
  }

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  window.addEventListener("scroll", checkScrollTop)

  return (
    <button
      key={Date.now()}
      className="scrollTop"
      onClick={scrollTop}
      style={{ display: showScroll ? "block" : "none" }}
    >
      <RiArrowUpLine />
    </button>
  )
}
