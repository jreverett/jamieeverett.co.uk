import React from "react"
import SectionBackground from "../SectionBackground/SectionBackground"
import "./BackgroundLayout.css"

export default function BackgroundLayout({ children }) {
  const sections = [
    {
      id: 'intro',
      height: '85vh',
      colors: {
        color1: "rgba(168, 85, 247, 0.2)",  // Purple
        color2: "rgba(236, 72, 153, 0.2)"   // Pink
      }
    },
    {
      id: 'about',
      height: '600px',
      colors: {
        color1: "rgba(236, 72, 153, 0.2)",  // Pink
        color2: "rgba(59, 130, 246, 0.2)"   // Blue
      }
    },
    {
      id: 'skills',
      height: '550px',
      colors: {
        color1: "rgba(59, 130, 246, 0.2)",  // Blue
        color2: "rgba(52, 211, 153, 0.2)"   // Emerald
      }
    },
    {
      id: 'projects',
      height: '800px',
      colors: {
        color1: "rgba(52, 211, 153, 0.2)",  // Emerald
        color2: "rgba(168, 85, 247, 0.2)"   // Purple
      }
    }
  ]

  return (
    <div className="background-layout">
      {/* Fixed background layer */}
      <div className="background-sections">
        {sections.map(section => (
          <div key={section.id} className="section-wrapper">
            <SectionBackground {...section.colors} sectionHeight={section.height} />
          </div>
        ))}
      </div>
      
      {/* Content layer */}
      <div className="content-layer">
        {children}
      </div>
    </div>
  )
}