import React, { useState, useEffect } from "react"
import "./Intro.css"

const TYPING_PHRASES = [
  'working in Bristol',
  'creating .NET applications',
  'maintaining Azure cloud infrastructure',
  'creating cross-platform MAUI applications',
  "creating Azure DevOps pipelines",
  'building React frontends',
]

const TypingTerminal = () => {
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 530)

    return () => clearInterval(cursorInterval)
  }, [])

  useEffect(() => {
    const currentPhrase = TYPING_PHRASES[currentPhraseIndex]
    const typeSpeed = isDeleting ? 50 : 100
    
    const timeout = setTimeout(() => {
      if (!isDeleting && displayText === currentPhrase) {
        setTimeout(() => setIsDeleting(true), 1500)
      } else if (isDeleting && displayText === '') {
        setIsDeleting(false)
        setCurrentPhraseIndex((prev) => (prev + 1) % TYPING_PHRASES.length)
      } else if (isDeleting) {
        setDisplayText(prev => prev.slice(0, -1))
      } else {
        setDisplayText(currentPhrase.slice(0, displayText.length + 1))
      }
    }, typeSpeed)

    return () => clearTimeout(timeout)
  }, [displayText, isDeleting, currentPhraseIndex])

  return (
    <div className="terminal">
      {`> Currently ${displayText}`}
      <span className={`cursor ${showCursor ? 'visible' : 'hidden'}`} />
    </div>
  )
}

export default function Intro() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <section id="intro" className="intro">
      <div className="background-effects">
        <div className="blur-effect blur-effect-1" />
        <div className="blur-effect blur-effect-2" />
      </div>

      <div className="intro-content">
        <h1 className={`intro-title ${isLoaded ? 'visible' : ''}`}>
          Hi, I'm Jamie
          <span className="intro-subtitle">
            A full stack developer specialising in .NET
          </span>
        </h1>
        
        <TypingTerminal />
      </div>
    </section>
  )
}