"""Chromium stacking test: native Settings fully covers map editor chrome."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
CSS=(Path(__file__).parent.parent/'index.css').read_text(encoding='utf8')

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1280,'height':800})
        await page.set_content('''<!doctype html><html><head><style>
        body{margin:0;font:16px sans-serif}
        .protyle{position:relative;width:100%;height:780px;background:#fdfdfd}
        .protyle-breadcrumb{position:absolute;left:0;top:0;right:0;height:50px;background:#eef;z-index:2}
        .protyle-util{position:absolute;left:0;top:50px;right:0;height:50px;background:#ddf;z-index:2}
        .smm-inline-portal{top:150px;left:120px;width:900px;height:550px}
        .protyle-hint{position:absolute;top:230px;left:220px;width:240px;height:180px;background:#fde;z-index:2}
        .b3-dialog{position:fixed;inset:0;z-index:10;background:rgba(0,0,0,.35)}
        .b3-dialog__container{position:absolute;top:40px;left:300px;right:300px;height:650px;background:white}
        </style></head><body>
        <div class="protyle"><div class="protyle-breadcrumb" id="breadcrumb">面包屑</div>
        <div class="protyle-util" id="util">思源原生工具栏</div>
        <div class="smm-inline-portal" id="map">导图</div>
        <div class="protyle-hint" id="hint">斜杠菜单</div></div>
        <div class="b3-dialog b3-dialog--open" id="dialog"><div class="b3-dialog__container" id="settings">设置</div></div>
        </body></html>''')
        await page.add_style_tag(content=CSS)
        async def hit(x,y):
            return await page.evaluate('([x,y])=>document.elementFromPoint(x,y).id',[x,y])
        assert await hit(650,55)=='settings',('Settings top hidden', await hit(650,55))
        assert await hit(650,90)=='settings',('Settings toolbar hidden', await hit(650,90))
        assert await hit(650,300)=='settings',('Settings body hidden', await hit(650,300))
        assert await hit(230,280)=='dialog',('Settings scrim hidden by popup',await hit(230,280))
        # Expanded map should not leap above the native settings window.
        await page.evaluate('document.querySelector("#map").classList.add("smm-inline-expanded")')
        assert await hit(650,300)=='settings',('Expanded map hides Settings',await hit(650,300))
        # Native popup above map once dialog closes, including after expanding.
        await page.evaluate('''()=>{document.querySelector('#map').classList.remove('smm-inline-expanded');document.querySelector('#dialog').remove()}''')
        assert await hit(230,280)=='hint',('Native hint hidden by iframe',await hit(230,280))
        assert await hit(650,170)=='map',('Map hidden after dialog closes',await hit(650,170))
        print('Settings stacking checks passed: breadcrumb, util, modal, expanded map, native hint')
        await browser.close()

asyncio.run(main())
