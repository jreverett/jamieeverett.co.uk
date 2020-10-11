import React from "react"

import "./Skills.css"

export default function Skills() {
  return (
    <section id="skills">
      <div className="skills-container">
        <h1>Skills</h1>
        <div className="skills-grid-container">
          <div>
            <h2>Languages</h2>
            <ul>
              <li>HTML5</li>
              <li>CSS3</li>
              <li>Javascript (ES6)</li>
              <li>C#</li>
              <li>C++</li>
              <li>SQL</li>
              <li>Bash</li>
              <li>Swift</li>
              <li>Python (learning!)</li>
            </ul>
          </div>
          <div>
            <h2>Frameworks & Libs</h2>
            <ul>
              <li>React.js</li>
              <li>jQuery</li>
              <li>Node.js</li>
              <li>Express.js</li>
              <li>Gatsby</li>
              <li>GraphQL</li>
              <li>.NET</li>
              <li>Entity Framework 6</li>
            </ul>
          </div>
          <div>
            <h2>Tools</h2>
            <ul>
              <li>Git & GitHub</li>
              <li>Azure DevOps</li>
              <li>Heroku</li>
              <li>Netlify</li>
              <li>MongoDB & MongoDB Atlas</li>
            </ul>
          </div>
          <div>
            <h2>Additional</h2>
            <ul>
              <li>Agile methodology</li>
              <li>Unified Modelling Language</li>
              <li>Mobile app development (Xcode)</li>
              <li>Premiere Pro & After Effects</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
