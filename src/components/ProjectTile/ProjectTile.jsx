import React from "react"
import Img from "gatsby-image"

import "./ProjectTile.css"

export default function ProjectTile(props) {
  const { projectName, projectImage, sourceUrl, CIUrl, CDUrl, tags } = props
  const tagUrls = props.tagUrls

  return (
    <div className="project-tile">
      <h2>{projectName}</h2>
      <Img
        className="project-tile-image"
        fluid={projectImage.node.childImageSharp.fluid}
        alt={`Screenshot of ${projectName} project`}
      />
      <div className="project-tile-links">
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Source
          </a>
        )}
        {CIUrl && (
          <a href={CIUrl} target="_blank" rel="noopener noreferrer">
            Build
          </a>
        )}
        {CDUrl && (
          <a href={CDUrl} target="_blank" rel="noopener noreferrer">
            Deploy
          </a>
        )}
      </div>
      <div className="project-tile-tags">
        {tags.map((tag, index) => {
          const tagUrl = tagUrls.find(t => t.name === tag)
          if (tagUrl) {
            return (
              <a
                key={index}
                href={tagUrl.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tag}
              </a>
            )
          } else {
            return <p key={index}>{tag}</p>
          }
        })}
      </div>
    </div>
  )
}
