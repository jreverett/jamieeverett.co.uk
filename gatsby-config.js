/**
 * @type {import('gatsby').GatsbyConfig}
 */
const path = require("path")
module.exports = {
  siteMetadata: {
    title: "Jamie Everett - Portfolio & Blog",
    description:
      "Personal website and project portfolio for Jamie Everett, graduate software developer ✌️",
    author: "Jamie Everett",
    image: "/me.jpg",
    siteUrl: "https://www.jamieeverett.co.uk",
    projects: [
      {
        name: "jamieeverett.co.uk",
        imageName: "jamieeverett-co-uk",
        sourceUrl: "https://github.com/jreverett/jamieeverett.co.uk",
        CDUrl:
          "https://app.netlify.com/sites/quirky-chandrasekhar-d7c462/deploys",
        tags: ["ReactJS", "Gatsby", "GraphQL"],
      },
      {
        name: "Upvent",
        imageName: "upvent",
        sourceUrl: "https://github.com/jreverett/FinalYearProject",
        CIUrl: "https://dev.azure.com/jamieeverett0462/PRCO304-Upvent/_build",
        CDUrl: "https://upvent-app.herokuapp.com",
        tags: ["ReactJS", "NodeJS", "ExpressJS", "MongoDB", "JWT", "Jest"],
      },
      {
        name: "Pictionary",
        imageName: "pictionary",
        sourceUrl: "https://github.com/jreverett/SOFT355-PictionaryWebApp",
        CIUrl:
          "https://dev.azure.com/jamieeverett0462/SOFT355-Pictionary/_build",
        CDUrl: "https://soft355-pictionary.herokuapp.com",
        tags: [
          "VanillaJS",
          "NodeJS",
          "ExpressJS",
          "SocketIO",
          "MongoDB",
          "Mocha",
          "Chai",
        ],
      },
      {
        name: "Snake 3D",
        imageName: "snake-3d",
        sourceUrl: "https://github.com/jreverett/Snake-3D",
        tags: ["C++", "OpenGL"],
      },
      {
        name: "Model Loader",
        imageName: "model-loader",
        sourceUrl: "https://github.com/jreverett/Model-Loader",
        tags: ["C++", "OpenGL"],
      },
      {
        name: "Dungeon Crawler",
        imageName: "dungeon-crawler",
        sourceUrl: "https://github.com/jreverett/DungeonCrawler",
        tags: ["C++"],
      },
    ],
    tagUrls: [
      { name: "ReactJS", url: "https://reactjs.org" },
      { name: "Gatsby", url: "https://www.gatsbyjs.com" },
      { name: "GraphQL", url: "https://graphql.org" },
      { name: "VanillaJS", url: "https://www.javascript.com/" },
      { name: "NodeJS", url: "https://nodejs.org/en/" },
      { name: "ExpressJS", url: "https://expressjs.com" },
      { name: "MongoDB", url: "https://www.mongodb.com" },
      { name: "JWT", url: "https://jwt.io" },
      { name: "Jest", url: "https://jestjs.io" },
      { name: "SocketIO", url: "https://socket.io" },
      { name: "Mocha", url: "https://mochajs.org" },
      { name: "Chai", url: "https://www.chaijs.com" },
      { name: "C++", url: "https://en.wikipedia.org/wiki/C%2B%2B" },
      { name: "OpenGL", url: "https://www.opengl.org" },
    ],
  },
  plugins: [
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: path.join(__dirname, `src`, `assets`, `images`),
      },
    },
    `gatsby-plugin-react-helmet`,
    `gatsby-plugin-image`,
    `gatsby-transformer-sharp`,
    `gatsby-plugin-sharp`,
  ],
}