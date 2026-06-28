import "./src/pages/global.css"

// Override Gatsby's default scroll on navigation so the jump is instant,
// not a smooth animation that briefly reveals the bottom of a shorter page
// (because html { scroll-behavior: smooth } would otherwise animate it).
export const shouldUpdateScroll = ({
  routerProps: { location },
  getSavedScrollPosition,
}) => {
  const savedPosition = getSavedScrollPosition(location) || [0, 0]
  if (typeof window !== "undefined") {
    window.scrollTo({
      left: savedPosition[0],
      top: savedPosition[1],
      behavior: "instant",
    })
  }
  return false
}

// A note for anyone who opens the console. Most visitors never will.
export const onClientEntry = () => {
  if (typeof window === "undefined") return
  console.log(
    "%cnot everything here renders. the rest is salted away in robots.txt.",
    "color:#00d4d4;font:700 14px/1.6 ui-monospace,monospace"
  )
}