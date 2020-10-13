import React from "react"
import { Helmet } from "react-helmet"
import { useStaticQuery, graphql } from "gatsby"

export default function SEO({ description, lang }) {
  const { site } = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          description
        }
      }
    }
  `)

  const metaDescription = description || site.siteMetadata.description

  return (
    <Helmet
      htmlAttributes={{ lang }}
      meta={[{ name: "description", content: metaDescription }]}
    />
  )
}

SEO.defaultProps = {
  lang: "en",
  meta: [],
  description: "",
}
