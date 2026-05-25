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