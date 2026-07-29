const assert = require('assert')
const { chromium } = require('playwright')

const h5Url = process.env.H5_URL || 'http://127.0.0.1:8080/#/'
const headless = process.env.PW_HEADLESS !== 'false'
const expectedText = process.env.H5_EXPECT_TEXT || '蝶变'

async function run() {
  console.log(`[pw-h5-smoke] node=${process.version}`)
  console.log(`[pw-h5-smoke] url=${h5Url}`)
  console.log(`[pw-h5-smoke] headless=${headless}`)
  console.log(`[pw-h5-smoke] expectedText=${expectedText}`)

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-gpu']
  })

  try {
    const page = await browser.newPage()
    const response = await page.goto(h5Url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    const status = response ? response.status() : 0
    console.log(`[pw-h5-smoke] status=${status}`)
    assert(response && response.ok(), `Expected 2xx response, got ${status || 'NO_RESPONSE'}`)

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((error) => {
      console.log(`[pw-h5-smoke] networkidle skipped: ${error.message}`)
    })

    const title = await page.title()
    const bodyText = await page.locator('body').innerText({ timeout: 10000 })
    const pageText = `${title}\n${bodyText}`

    console.log(`[pw-h5-smoke] title=${title || '(empty)'}`)
    console.log(`[pw-h5-smoke] bodyLength=${bodyText.length}`)
    console.log(`[pw-h5-smoke] bodyPreview=${bodyText.slice(0, 300).replace(/\s+/g, ' ')}`)

    assert(pageText.includes(expectedText), `Expected page to contain "${expectedText}"`)
    assert(pageText.includes('AI 快改图 + 人工设计服务'), 'Expected website hero title to be visible')
    assert(pageText.includes('核心服务'), 'Expected website services section to be visible')
    assert(pageText.includes('案例方向'), 'Expected website cases section to be visible')
    assert(pageText.includes('服务流程'), 'Expected website flow section to be visible')
    assert(pageText.includes('提交设计需求'), 'Expected website demand CTA to be visible')

    console.log('[pw-h5-smoke] PASS')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('[pw-h5-smoke] FAIL')
  console.error(error)
  process.exit(1)
})
