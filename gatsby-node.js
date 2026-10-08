// Every build proves fresh native processing, including builds with cached Gatsby images.
exports.onPreInit = async ({ reporter }) => {
  const { verifyNativeTrim } = require("./scripts/verify-sharp-native.cjs")
  const proof = await verifyNativeTrim()
  reporter.info(`FRESH_SHARP_NATIVE_PROOF ${JSON.stringify(proof)}`)
}
