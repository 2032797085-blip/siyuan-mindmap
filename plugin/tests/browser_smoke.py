import asyncio, mimetypes, json
from urllib.parse import urlparse, unquote
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent

async def run():
    async with async_playwright() as playwright:
        browser=await playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=await browser.new_page(viewport={'width':1180,'height':950})
        errors=[]; console_errors=[]; not_found=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
        async def router(route):
            request_path=unquote(urlparse(route.request.url).path)
            if request_path=='/': path=ROOT/'tests/browser-harness.html'
            elif request_path.startswith('/plugins/siyuan-mindmap/'):
                path=ROOT/request_path.removeprefix('/plugins/siyuan-mindmap/')
            else: path=ROOT/'not-found'
            if path.is_file():
                await route.fulfill(status=200,body=path.read_bytes(),content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
            else:
                not_found.append(request_path)
                await route.fulfill(status=404,body='Not Found')
        await page.route('**/*',router)
        await page.goto('http://127.0.0.1:6806/',wait_until='load',timeout=30000)
        await page.locator('.smm-inline-status').get_by_text('可编辑',exact=False).wait_for(timeout=20000)
        frame=page.frame_locator('.smm-inline-iframe')
        assert await frame.locator('body').inner_text()
        initial=await page.evaluate('window.plugin.sessions.values().next().value.frame')
        session_before=await page.evaluate('window.plugin.sessions.keys().next().value')
        root_data={'root':{'data':{'text':'自动保存后不中断编辑'},'children':[]},'theme':{'template':'avocado','config':{}},'layout':'logicalStructure','config':{},'view':None}
        await frame.locator('body').evaluate('(data)=>window.takeOverAppMethods.saveMindMapData(data)',root_data)
        await page.wait_for_timeout(1800)
        saved=await page.evaluate('window.saves')
        session_after=await page.evaluate('window.plugin.sessions.keys().next().value')
        remounts=await page.evaluate('window.remounts')
        status=await page.locator('.smm-inline-status').inner_text()
        print('SAVES',len(saved),'REMOUNTS',remounts,'STATUS',status)
        assert saved and json.loads(saved[-1])['mindMapData']['root']['data']['text']=='自动保存后不中断编辑'
        assert remounts>=1, 'SiYuan rerender should be simulated'
        assert session_before==session_after, 'iframe was recreated when saved'
        assert await page.locator('.smm-inline-iframe').count()==1
        assert '已保存' in status
        assert await frame.locator('body').inner_text(), 'editor canvas disappeared after save'
        assert len(errors)==0,errors
        assert len(not_found)==0,not_found
        # Multiple modifications use the same embedded app instance.
        await frame.locator('body').evaluate('()=>window.takeOverAppMethods.saveLanguage("en")')
        await page.wait_for_timeout(1700)
        assert await page.evaluate('window.remounts')>=2
        assert await page.evaluate('window.plugin.sessions.keys().next().value')==session_before
        assert json.loads((await page.evaluate('window.saves'))[-1])['lang']=='en'
        await page.locator('.smm-inline-button').nth(2).click()
        assert await page.locator('.smm-inline-expanded').count()==1
        await page.locator('.smm-inline-button').nth(2).click()
        assert await page.locator('.smm-inline-expanded').count()==0
        print('JS ERRORS',errors[:5], 'CONSOLE ERRORS', console_errors[:5], '404',not_found[:5])
        await browser.close()

asyncio.run(run())
