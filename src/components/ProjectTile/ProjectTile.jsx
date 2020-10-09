import React from "react"

import "./ProjectTile.css"

export default function ProjectTile(props) {
  const { projectName, sourceUrl, CIUrl, CDUrl, tags } = props
  const tagUrls = props.tagUrls

  return (
    <div className="project-tile">
      <h3>{projectName}</h3>
      <img
        className="project-tile-image"
        src="https://via.placeholder.com/400x300"
      ></img>
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
