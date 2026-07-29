export function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        resolve(res)
      },
      fail: (error) => {
        reject(error)
      }
    })
  })
}

export function uploadFile(options) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      ...options,
      success: (res) => {
        resolve(res)
      },
      fail: (error) => {
        reject(error)
      }
    })
  })
}
