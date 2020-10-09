import React from "react"
import { useStaticQuery, graphql } from "gatsby"

import { ProjectTile } from "../"
import "./Projects.css"

export default function Projects() {
  const data = useStaticQuery(graphql`
    query ProjectQuery {
      site {
        siteMetadata {
          projects {
            name
            sourceUrl
            CIUrl
            CDUrl
            tags
          }
          tagUrls {
            name
            url
          }
        }
      }
    }
  `)

  const projects = data.site.siteMetadata.projects
  const tagUrls = data.site.siteMetadata.tagUrls
  return (
    <section id="projects">
      <h1>Projects</h1>
      <div className="project-tile-container">
        {projects.map((project, index) => {
          return (
            <ProjectTile
              key={index}
              projectName={project.name}
              sourceUrl={project.sourceUrl}
              CIUrl={project.CIUrl}
              CDUrl={project.CDUrl}
              tags={project.tags}
              tagUrls={tagUrls}
            />
          )
        })}
      </div>
    </section>
  )
}
