import React from "react"
import "./SectionBackground.css"

const SectionBackground = ({ color1, color2, sectionHeight = '100vh' }) => {
  return (
    <div className="section-background" style={{ minHeight: sectionHeight }}>
      <div
        className="background-blob"
        style={{
          backgroundColor: color1
        }}
      />
      <div
        className="background-blob"
        style={{
          backgroundColor: color2
        }}
      />
    </div>
  )
}

export default SectionBackground