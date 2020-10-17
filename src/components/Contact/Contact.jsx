import React, { useState } from "react"
import { navigate } from "gatsby"
import { RiMailSendLine } from "react-icons/ri"
import { SiLinkedin, SiGithub } from "react-icons/si"

import "./Contact.css"

// encodes captured data from the form in the format required by Netlify
function encode(data) {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&")
}

export default function Contact() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = event => {
    event.preventDefault()

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encode({
        "form-name": event.target.getAttribute("name"),
        email,
        name,
        message,
      }),
    })
      .then(() => navigate("/success"))
      .catch(error => alert("Sorry, your message failed to send: ", error))
  }

  return (
    <section id="contact">
      <h1>Contact Me</h1>
      <a
        className="contact-form-social-button"
        href="https://github.com/jreverett"
        target="_blank"
        rel="noopener noreferrer"
      >
        <SiGithub />
      </a>
      <a
        className="contact-form-social-button"
        href="https://www.linkedin.com/in/jamie-everett-135755153/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <SiLinkedin />
      </a>
      <div className="contact-form-container">
        <form
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          className="contact-form"
          name="contact"
          method="post"
          action="/"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="form-name" value="contact" />
          <input type="hidden" name="bot-field"></input>
          <label htmlFor="contact-form-email">Email</label>
          <input
            id="contact-form-email"
            className="contact-form-input"
            type="email"
            name="email"
            required
            onChange={({ target }) => setEmail(target.value)}
          />
          <label htmlFor="contact-form-name">Name</label>
          <input
            id="contact-form-name"
            className="contact-form-input"
            type="text"
            name="name"
            required
            onChange={({ target }) => setName(target.value)}
          />
          <label htmlFor="contact-form-message">Message</label>
          <textarea
            id="contact-form-message"
            className="contact-form-input"
            name="message"
            placeholder="Say hi!"
            rows="5"
            cols="50"
            required
            onChange={({ target }) => setMessage(target.value)}
          />
          <button className="contact-form-submit" type="submit">
            Send <RiMailSendLine />
          </button>
        </form>
      </div>
    </section>
  )
}
