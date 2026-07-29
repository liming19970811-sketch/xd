const { chromium } = require('playwright')

const h5Url = process.env.H5_URL || 'http://127.0.0.1:8080/#/'
const headless = process.env.PW_HEADLESS !== 'false'

async function main() {
  console.log(`[pw-smoke] node=${process.version}`)
  console.log(`[pw-smoke] url=${h5Url}`)
  console.log(`[pw-smoke] headless=${headless}`)

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

    console.log(`[pw-smoke] status=${response ? response.status() : 'NO_RESPONSE'}`)

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((error) => {
      console.log(`[pw-smoke] networkidle skipped: ${error.message}`)
    })

    const title = await page.title()
    const bodyText = await page.locator('body').innerText({ timeout: 10000 })

    console.log(`[pw-smoke] title=${title || '(empty)'}`)
    console.log(`[pw-smoke] bodyLength=${bodyText.length}`)
    console.log(`[pw-smoke] bodyPreview=${bodyText.slice(0, 300).replace(/\s+/g, ' ')}`)

    if (!response || !response.ok()) {
      throw new Error(`Page response is not OK: ${response ? response.status() : 'NO_RESPONSE'}`)
    }

    if (!bodyText.trim()) {
      throw new Error('Page body is empty after load')
    }

    console.log('[pw-smoke] PASS')
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error('[pw-smoke] FAIL')
  console.error(error)
  process.exit(1)
})
