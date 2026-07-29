const MB = 1024 * 1024
const KB = 1024

module.exports = Object.freeze({
  mainPackageWarning: 1.2 * MB,
  mainPackageBlocking: 1.5 * MB,
  subPackageWarning: 1.2 * MB,
  subPackageBlocking: 1.5 * MB,
  totalWarning: 8 * MB,
  totalBlocking: 12 * MB,
  singleAssetWarning: 200 * KB,
  singleAssetBlocking: 1024 * KB,
  wechatReference: Object.freeze({
    mainPackage: 2 * MB,
    subPackage: 2 * MB,
    total: 20 * MB,
    advisoryOnly: true
  })
})
