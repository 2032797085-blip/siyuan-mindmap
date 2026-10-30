"""Browser-only DOM smoke: the source toolbar docks inside the node actions group."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1440,'height':750})
        await page.set_content('''<div class="toolbarContainer"><div class="toolbar"><div class="toolbarBlock"><div class="toolbarNodeBtnList">\n          <button type="button">新建节点</button></div></div></div></div>\n          <div class="richTextToolbar" style="position:absolute;top:250px;left:900px" id="format"><div class="btn" role="button">B</div></div>''')
        await page.add_style_tag(content=(ROOT/'integration/editor/format-toolbar.css').read_text())
        await page.evaluate((ROOT/'integration/editor/format-toolbar.js').read_text())
        await page.evaluate('window.siyuanDockRichTextToolbar(document.getElementById("format"))')
        assert await page.locator('.toolbarContainer .siyuan-format-host .richTextToolbar').count()==1
        assert await page.locator('.richTextToolbar').evaluate('(e)=>getComputedStyle(e).position')=='static'
        assert await page.locator('.richTextToolbar').evaluate('(e)=>getComputedStyle(e).pointerEvents')=='none'
        await page.locator('.richTextToolbar').evaluate('(e)=>e.classList.add("siyuan-format-enabled")')
        assert await page.locator('.richTextToolbar').evaluate('(e)=>getComputedStyle(e).pointerEvents')!='none'
        print('PASS: formatting controls docked; no selection popup; enabled state works')
        await browser.close()
asyncio.run(main())
