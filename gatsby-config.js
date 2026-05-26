/**
 * @type {import('gatsby').GatsbyConfig}
 */
const path = require("path")
module.exports = {
  siteMetadata: {
    title: "Jamie Everett",
    description:
      "Personal website and project portfolio for Jamie Everett, graduate software developer ✌️",
    author: "Jamie Everett",
    image: "/me.jpg",
    siteUrl: "https://www.jamieeverett.co.uk",
    projects: [
      {
        name: "jamieeverett.co.uk",
        description: "Personal portfolio with interactive WebGL fluid simulation background.",
        sourceUrl: "https://github.com/jreverett/jamieeverett.co.uk",
        tags: ["React", "Gatsby", "WebGL"],
      },
      {
        name: "everetteats.co.uk",
        description: "Personal recipe website with filterable search and mobile-optimised design.",
        imageName: "everetteats-co-uk",
        sourceUrl: "https://github.com/jreverett/EverettEats",
        liveUrl: "https://everetteats.co.uk",
        tags: [".NET 10", "Blazor Server", "C#"],
      },
      {
        name: "Voice-to-Text",
        description: "Local push-to-talk speech-to-text for Windows. Hold a hotkey, speak, release — transcribed text lands in your clipboard. 100% offline, powered by whisper.cpp.",
        sourceUrl: "https://github.com/jreverett/voice-to-text",
        downloadsUrl: "/releases/voice-to-text",
        tags: ["AutoHotkey", "C#", ".NET 10", "whisper.cpp"],
      },
      {
        name: "WhoPaid",
        description: "Receipt splitter app with AI-powered OCR. Upload a photo, assign items to people, and share each person's total via WhatsApp or SMS.",
        imageName: "whopaid",
        sourceUrl: "https://github.com/jreverett/WhoPaid",
        liveUrl: "https://who-paid.netlify.app",
        tags: ["JavaScript", "Gemini API", "Turso"],
      },
      {
        name: "AutoInvestor",
        description: "Autonomous AI-powered day trading bot using LLMs to analyse real-time market data, news sentiment, and technical indicators for live trading decisions.",
        imageName: "autoinvestor",
        closedSource: true,
        tags: [".NET 10", "Blazor Server", "C#", "AI/LLMs", "Turso"],
      },
      {
        name: "GTO Trainer",
        description: "Texas Hold'em study tool built around a self-trained card and table detection model that reads the felt straight off-screen. You commit your action before it reveals the GTO maths — ranked plays, pot odds, equity, EV, and a deviation grade from a pure-algorithm equity engine.",
        imageName: "gto-trainer",
        closedSource: true,
        tags: ["TypeScript", "Next.js", "Electron", "YOLO"],
      },
    ],
    tagUrls: [
      { name: "React", url: "https://react.dev" },
      { name: "Gatsby", url: "https://www.gatsbyjs.com" },
      { name: "WebGL", url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API" },
      { name: "JavaScript", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
      { name: "Gemini API", url: "https://ai.google.dev/" },
      { name: ".NET 10", url: "https://dotnet.microsoft.com/" },
      { name: "Blazor Server", url: "https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor" },
      { name: "C#", url: "https://learn.microsoft.com/en-us/dotnet/csharp/" },
      { name: "AI/LLMs", url: "https://en.wikipedia.org/wiki/Large_language_model" },
      { name: "Turso", url: "https://turso.tech/" },
      { name: "AutoHotkey", url: "https://www.autohotkey.com/" },
      { name: "whisper.cpp", url: "https://github.com/ggerganov/whisper.cpp" },
      { name: "TypeScript", url: "https://www.typescriptlang.org/" },
      { name: "Next.js", url: "https://nextjs.org/" },
      { name: "Electron", url: "https://www.electronjs.org/" },
      { name: "YOLO", url: "https://docs.ultralytics.com/" },
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