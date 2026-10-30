"""Optional Chromium layout smoke test: python plugin/tests/collapse_browser.py"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
SOURCE=(ROOT/'src/index.js').read_text(encoding='utf8')
CSS=(ROOT/'index.css').read_text(encoding='utf8')
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=await browser.new_page(viewport={'width':1920,'height':1040})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.set_content('''<!doctype html><html><head><meta charset="utf-8"></head><body>
        <div class="protyle" style="position:relative;margin:40px auto;width:1600px;min-height:1000px">
          <div class="protyle-title" style="height:100px">测试文档</div>
          <div class="protyle-content" style="height:900px;overflow:auto;padding-top:30px">
            <div data-node-id="test-block"><div id="mount"></div></div>
          </div>
        </div><script>
          window.exports={};window.siyuan={config:{readonly:false}};
          window.require=name=>({Plugin:class{constructor(){this.name='siyuan-mindmap';this.customBlockRenders={}}async loadData(){}addIcons(){}addToolbarItem(){}addBreadcrumbButton(){}},Setting:class{addItem(){}},showMessage:()=>{}});
        </script></body></html>''')
        await page.add_style_tag(content=CSS)
        await page.add_script_tag(content=SOURCE)
        await page.evaluate('''async()=>{
          window.plugin=new window.exports.default();await plugin.onload();
          const content=JSON.stringify(exports.__test.blankMap());
          plugin.renderEmbeddedMap({element:document.querySelector('#mount'),content,setContent:()=>true});
          window.rec=[...plugin.sessions.values()][0];rec.editorReady=true;rec.frame.contentWindow.postMessage=()=>{};plugin.schedulePositions();
        }''')
        await page.wait_for_timeout(450)
        before=await page.evaluate('''()=>({slot:rec.slot.getBoundingClientRect().height,root:rec.root.getBoundingClientRect().height,frame:rec.frame.getBoundingClientRect().height,session:rec.session})''')
        assert abs(before['slot']-839)<1,before
        width=await page.evaluate('''()=>rec.slot.getBoundingClientRect().width''')
        assert abs(width-1447)<1, width
        # On a narrower SiYuan editor, the block must shrink rather than overflow.
        await page.evaluate("document.querySelector('.protyle').style.width='700px'")
        narrow=await page.evaluate('''()=>rec.slot.getBoundingClientRect().width''')
        assert abs(narrow-700)<1, narrow
        await page.evaluate("document.querySelector('.protyle').style.width='1600px'")
        await page.evaluate('''()=>rec.setCollapsed(true)''')
        await page.wait_for_timeout(90)
        collapsed=await page.evaluate('''()=>({slot:rec.slot.getBoundingClientRect().height,root:rec.root.getBoundingClientRect().height,frame:rec.frame.getBoundingClientRect().height,iframeVisibility:getComputedStyle(rec.frame).visibility,button:rec.root.querySelector('.smm-inline-collapse-button').textContent,tools:[...rec.root.querySelectorAll('.smm-inline-button')].filter(el=>getComputedStyle(el).display!=='none').length,session:rec.session})''')
        assert collapsed['slot']==48,collapsed
        assert collapsed['root']==48,collapsed
        assert collapsed['frame']==799,collapsed
        assert collapsed['iframeVisibility']=='hidden',collapsed
        assert collapsed['button']=='展开' and collapsed['tools']==1,collapsed
        await page.evaluate('''()=>{rec.setCollapsed(false);clearTimeout(rec.resumeTimer);rec.resumeTimer=null}''')
        await page.wait_for_timeout(230)
        restored=await page.evaluate('''()=>({slot:rec.slot.getBoundingClientRect().height,root:rec.root.getBoundingClientRect().height,frameVisibility:getComputedStyle(rec.frame).visibility,button:rec.root.querySelector('.smm-inline-collapse-button').textContent,session:rec.session})''')
        assert abs(restored['slot']-839)<1,restored
        assert restored['frameVisibility']=='visible',restored
        assert restored['button']=='最小化' and before['session']==restored['session'],restored
        assert not errors, errors
        print('PASS Chromium real layout: before',before,'collapsed',collapsed,'restored',restored)
        await browser.close()
asyncio.run(main())
