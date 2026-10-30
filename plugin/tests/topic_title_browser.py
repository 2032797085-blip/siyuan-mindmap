"""Optional Chromium smoke test for the minimized center-topic title.
Run with: python plugin/tests/topic_title_browser.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / 'src/index.js').read_text(encoding='utf-8')
CSS = (ROOT / 'index.css').read_text(encoding='utf-8')

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            executable_path='/usr/bin/chromium',
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )
        page = await browser.new_page(viewport={'width': 900, 'height': 700})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.set_content('''<!doctype html><html><head><meta charset="utf-8"></head><body>
          <div class="protyle" style="position:relative;margin:20px;width:420px;min-height:600px">
            <div class="protyle-title" style="height:80px">测试文档</div>
            <div class="protyle-content" style="height:480px;overflow:auto;padding-top:25px">
              <div data-node-id="topic"><div id="mount"></div></div>
            </div>
          </div>
          <script>
            window.exports={};window.siyuan={config:{readonly:false}};
            window.require=name=>({Plugin:class{constructor(){this.name='siyuan-mindmap';this.customBlockRenders={}}async loadData(){}addIcons(){}addToolbarItem(){}addBreadcrumbButton(){}},Setting:class{addItem(){}},showMessage:()=>{}});
          </script></body></html>''')
        await page.add_style_tag(content=CSS)
        await page.add_script_tag(content=SOURCE)
        await page.evaluate('''async () => {
          window.plugin=new window.exports.default();await plugin.onload();
          const text='很长的中心主题：这是一个包含数学、物理、中文和很多很多文字的标题，需要在折叠时省略但展开按钮始终可用';
          plugin.renderEmbeddedMap({element:document.querySelector('#mount'),content:JSON.stringify(exports.__test.blankMap(text)),setContent:()=>true});
          window.rec=[...plugin.sessions.values()][0];rec.editorReady=true;
          rec.frame.contentWindow.postMessage=()=>{};plugin.schedulePositions();
          rec.setCollapsed(true);
        }''')
        await page.wait_for_timeout(450)
        result = await page.evaluate('''() => {
          const caption=rec.root.querySelector('.smm-inline-caption');
          const button=rec.root.querySelector('.smm-inline-collapse-button');
          const c=caption.getBoundingClientRect(), b=button.getBoundingClientRect(),r=rec.root.getBoundingClientRect();
          return {title: caption.textContent, tooltip: caption.title,
            truncated: caption.scrollWidth>caption.clientWidth,
            buttonVisible: b.left>=r.left && b.right<=r.right,
            captionVisible: c.width>50, height:r.height, collapsed:rec.collapsed};
        }''')
        assert result['title']==result['tooltip'], result
        assert result['truncated'], result
        assert result['buttonVisible'], result
        assert result['captionVisible'], result
        assert result['height']==48 and result['collapsed'], result
        dynamic=await page.evaluate('''() => {
          const copy=JSON.parse(JSON.stringify(rec.map.mindMapData));
          copy.root.data.text='<p><strong>更新 &amp; 已保存</strong></p><img src=x onerror="window.__unsafe=1">';
          rec.applyPatch({mindMapData:copy});
          const caption=rec.root.querySelector('.smm-inline-caption');
          const title=caption.textContent;
          const hasImage=rec.root.querySelectorAll('img').length;
          rec.setCollapsed(false);
          return {title,hasImage,unsafe:window.__unsafe||0,expanded:caption.textContent};
        }''')
        assert dynamic == {'title':'更新 & 已保存','hasImage':0,'unsafe':0,'expanded':'思维导图'}, dynamic
        assert not errors,errors
        print('PASS Chromium long-topic ellipsis and XSS-safe DOM:',result,'dynamic:',dynamic)
        await browser.close()

asyncio.run(main())
