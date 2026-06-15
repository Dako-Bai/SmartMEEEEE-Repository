import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Index Page
        await page.goto(f'file://{os.getcwd()}/index.html')
        await page.screenshot(path='/app/verification/screenshots/final_index.png', full_page=True)

        # 2. Auth Page
        await page.goto(f'file://{os.getcwd()}/auth.html')
        await page.screenshot(path='/app/verification/screenshots/final_auth.png')

        # 3. Admin Page
        await page.goto(f'file://{os.getcwd()}/admin.html')
        await page.screenshot(path='/app/verification/screenshots/final_admin.png', full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
