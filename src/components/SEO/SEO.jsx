import React from "react"
import PropTypes from "prop-types"
import { Helmet } from "react-helmet"
import { useStaticQuery, graphql } from "gatsby"

export default function SEO({
  title,
  description,
  lang,
  meta,
  image: metaImage,
  pathname,
}) {
  const { site } = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          title
          description
          author
          defaultImage: image
          siteUrl
        }
      }
    }
  `)

  const metaDescription = description || site.siteMetadata.description
  const image = `${site.siteMetadata.siteUrl}${
    metaImage || site.siteMetadata.defaultImage
  }`
  const canonical = pathname ? `${site.siteMetadata.siteUrl}${pathname}` : null

  return (
    <Helmet
      title={title}
      titleTemplate={`%s | ${site.siteMetadata.title}`}
      link={canonical ? [{ rel: "canonical", href: canonical }] : []}
      htmlAttributes={{ lang }}
      meta={[
        { name: "description", content: metaDescription },
        { property: "og:title", content: title },
        { property: "og:description", content: metaDescription },
        { property: "og:type", content: "website" },
        { property: "twitter:creator", content: site.siteMetadata.author },
        { property: "twitter:title", content: title },
        { property: "twitter:description", content: metaDescription },
      ]
        .concat(
          { property: "og:image", content: image },
          { name: "twitter:image", content: image },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "twitter:card", content: "summary" }
        )
        .concat(meta)}
    />
  )
}

SEO.defaultProps = {
  lang: "en",
  meta: [],
  description: "",
}

SEO.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  lang: PropTypes.string,
  meta: PropTypes.arrayOf(PropTypes.object),
  image: PropTypes.string,
  pathname: PropTypes.string,
}
