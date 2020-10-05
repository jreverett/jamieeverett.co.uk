import React from "react"
import { Link } from "gatsby"
import { Helmet } from "react-helmet"
import { BiArrowBack } from "react-icons/bi"

import { Header } from "../components"
import "./success.css"

export default function success() {
  return (
    <>
      <Helmet>
        <title>Message Sent</title>
      </Helmet>
      <Header />
      <div className="success-container">
        <p>
          Thanks!{" "}
          <span role="img" aria-label="peace-emoji">
            ✌️
          </span>
        </p>
        <p>Your message has been received.</p>
        <Link to="/">
          <BiArrowBack className="icon" /> Head back home
        </Link>
      </div>
    </>
  )
}
