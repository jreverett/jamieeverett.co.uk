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
            imageName
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
      allFile {
        edges {
          node {
            name
            childImageSharp {
              fluid(maxWidth: 500) {
                ...GatsbyImageSharpFluid
              }
            }
          }
        }
      }
    }
  `)

  const projects = data.site.siteMetadata.projects
  const tagUrls = data.site.siteMetadata.tagUrls
  const images = data.allFile.edges

  return (
    <section id="projects">
      <h1>Projects</h1>
      <div className="project-tile-container">
        {projects.map((project, index) => {
          const projectImage = images.find(
            image => image.node.name === project.imageName
          )

          return (
            <ProjectTile
              key={index}
              projectName={project.name}
              projectImage={projectImage}
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
