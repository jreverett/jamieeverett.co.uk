import React from "react"
import { useStaticQuery, graphql } from "gatsby"

// Returns raw <head> elements for Gatsby's built-in Head API
// (export const Head = () => <SEO ... />). useStaticQuery is supported in Head.
export default function SEO({
  title,
  description = "",
  image: metaImage,
  pathname,
  titleTemplate = true,
  twitterCard = "summary",
  children,
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
  const fullTitle = title
    ? titleTemplate
      ? `${title} | ${defaultTitle}`
      : title
    : defaultTitle

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title || defaultTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title || defaultTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:creator" content={author} />
      {canonical && <link rel="canonical" href={canonical} />}
      {children}
    </>
  )
}
