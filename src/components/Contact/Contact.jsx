import React from "react"
import { RiMailSendLine } from "react-icons/ri"

import "./Contact.css"

export default function Contact() {
  return (
    <section id="contact">
      <h1>Contact Me</h1>
      <div className="contact-form-container">
        <form
          className="contact-form"
          method="post"
          action="/success"
          netlify-honeypot="bot-field"
          data-netlify-recaptcha="true"
          data-netlify="true"
          name="contact"
        >
          <input type="hidden" name="bot-field" />
          <label htmlFor="email">Email</label>
          <input className="contact-form-input" type="email" name="email" />
          <label htmlFor="name">Name</label>
          <input className="contact-form-input" type="text" name="name" />
          <label htmlFor="message">Message</label>
          <textarea
            id="contact-form-textarea"
            className="contact-form-input"
            name="message"
            placeholder="Say hi!"
            rows="5"
            cols="50"
          />
          <div data-netlify-recaptcha="true"></div>
          <button className="contact-form-submit" type="submit">
            Send <RiMailSendLine />
          </button>
        </form>
      </div>
    </section>
  )
}
