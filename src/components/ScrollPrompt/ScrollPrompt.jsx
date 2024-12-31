import React, { useState, useEffect } from "react"

import "./ScrollPrompt.css"

export default function ScrollPrompt() {
  const [showPrompt, setShowPrompt] = useState(true)

  const onScroll = () => {
    if (!showPrompt && window.pageYOffset === 0) {
      setShowPrompt(true)
    } else if (showPrompt && window.pageYOffset > 0) {
      setShowPrompt(false)
    }
  }

  useEffect(() => {
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  })

  return (
    <div
      className="scroll-prompt"
      style={{ display: showPrompt ? "block" : "none" }}
    ></div>
  )
}
