const cloud = require('wx-server-sdk')
const { handleEventAction } = require('./core')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  return handleEventAction(event, wxContext)
}
