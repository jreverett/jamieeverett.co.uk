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
          defaultTitle: title
          defaultDescription: description
          author
          defaultImage: image
          siteUrl
        }
      }
    }
  `)

  const {
    defaultTitle,
    defaultDescription,
    author,
    defaultImage,
    siteUrl,
  } = site.siteMetadata

  const metaDescription = description || defaultDescription
  const image = `${siteUrl}${metaImage || defaultImage}`
  const url = `${siteUrl}${pathname || "/"}`
  const canonical = pathname ? `${siteUrl}${pathname}` : null

  return (
    <Helmet
      title={title}
      titleTemplate={`%s | ${defaultTitle}`}
      link={canonical ? [{ rel: "canonical", href: canonical }] : []}
      htmlAttributes={{ lang }}
      meta={[
        { name: "description", content: metaDescription },
        { name: "image", content: image },
        { property: "og:url", content: url },
        { property: "og:title", content: title },
        { property: "og:description", content: metaDescription },
        { property: "og:image", content: image },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: metaDescription },
        { name: "twitter:image", content: image },
        { name: "twitter:creator", content: author },
      ].concat(meta)}
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
