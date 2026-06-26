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
  const ink = "color:#00d4d4;font:600 13px/1.6 ui-monospace,monospace"
  const dim = "color:#55606b;font:12px/1.6 ui-monospace,monospace"
  console.log("%c// seasoned, then hashed.", ink)
  console.log(
    "%cnot everything here renders. the rest was salted away — ask the robots.",
    dim
  )
}