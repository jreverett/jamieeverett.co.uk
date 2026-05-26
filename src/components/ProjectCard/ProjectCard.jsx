import React, { useState } from "react"
import { Link } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"
import "./ProjectCard.css"

export default function ProjectCard({ project, image, tagUrls }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const {
    name,
    description,
    sourceUrl,
    liveUrl,
    downloadsUrl,
    closedSource,
    tags,
  } = project

  const imageData = image?.node?.childImageSharp?.gatsbyImageData
    ? getImage(image.node.childImageSharp.gatsbyImageData)
    : null

  const handleExpandClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleBadgeClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowTooltip(!showTooltip)
  }

  const handleBadgeMouseEnter = () => {
    setShowTooltip(true)
  }

  const handleBadgeMouseLeave = () => {
    setShowTooltip(false)
  }

  return (
    <div className={`project-card ${isExpanded ? "expanded" : ""}`}>
      <div className="project-card-header">
        <h3>{name}</h3>
        <div
          className={`source-badge ${closedSource ? "closed" : "open"}`}
          onClick={handleBadgeClick}
          onMouseEnter={handleBadgeMouseEnter}
          onMouseLeave={handleBadgeMouseLeave}
          role="button"
          tabIndex={0}
          aria-label={closedSource ? "Closed source project" : "Open source project"}
        >
          {closedSource ? (
            <svg
              className="source-icon"
              width="24" height="24" viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <svg
              className="source-icon"
              width="24" height="24" viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          )}
          {showTooltip && (
            <span className="source-tooltip">
              {closedSource ? "Closed Source" : "Open Source"}
            </span>
          )}
        </div>
      </div>

      <p className="project-description">{description}</p>

      <div className={`project-image-container ${isExpanded ? "show" : ""}`}>
        {imageData && (
          <GatsbyImage
            image={imageData}
            alt={`Screenshot of ${name}`}
            className="project-image"
          />
        )}
      </div>

      <div className="project-card-footer">
        <div className="project-tech">
          {tags.map((tag, index) => {
            const tagUrl = tagUrls?.find((t) => t.name === tag)
            return tagUrl ? (
              <a
                key={index}
                href={tagUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </a>
            ) : (
              <span key={index}>{tag}</span>
            )
          })}
        </div>

        <div className="project-links">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="project-link"
            >
              Source
            </a>
          )}
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="project-link"
            >
              Visit
            </a>
          )}
          {downloadsUrl && (
            <Link
              to={downloadsUrl}
              onClick={(e) => e.stopPropagation()}
              className="project-link download"
            >
              <svg
                className="download-icon"
                width="24" height="24" viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Download
            </Link>
          )}
          {imageData && (
            <button
              className="expand-btn"
              onClick={handleExpandClick}
              aria-label={isExpanded ? "Hide image" : "Show image"}
            >
              {isExpanded ? "Hide" : "Preview"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
