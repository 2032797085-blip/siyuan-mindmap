"""Host-only browser regression test: delayed SiYuan title and iframe startup.
This uses Playwright DOM simulation, not an installed SiYuan app.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / 'index.js').read_text()
CSS = (ROOT / 'index.css').read_text()

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=await browser.new_page(viewport={'width':1300,'height':900})
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.set_content('''<!doctype html><html><head><meta charset="utf-8"><style>
        body {margin:0; font:16px sans-serif; background:#f5f5f5}
        .protyle {position:relative; width:950px; height:850px; margin:20px auto; background:white}
        .protyle-content {position:relative; overflow:auto; height:820px; padding:12px; box-sizing:border-box}
        .protyle-title {height:140px; box-sizing:border-box; padding:12px; background:#fafafa}
        .protyle-wysiwyg {margin-top:15px}
        </style></head><body>
        <div id="protyle" class="protyle"><div class="protyle-content">
        <div id="title" class="protyle-title">这是思源文档标题</div>
        <div id="map-wrap" class="protyle-wysiwyg"><div data-node-id="map-block"><div id="mount"></div></div></div>
        </div></div>
        <script>window.exports={};window.siyuan={config:{readonly:false}};
        window.require=(name)=>({Plugin:class{constructor(){this.name='siyuan-mindmap';this.customBlockRenders={};this.storage={}}async loadData(k){return this.storage[k]}async saveData(k,v){this.storage[k]=v}addIcons(){}addToolbarItem(){}addBreadcrumbButton(){}},Setting:class{addItem(){}},showMessage:()=>{}});</script>
        </body></html>''')
        await page.add_style_tag(content=CSS)
        await page.add_script_tag(content=SOURCE)
        await page.evaluate('''async () => {
          window.plugin=new window.exports.default();
          await plugin.onload();
          const data={mindMapData:{root:{data:{text:'test'},children:[]},theme:{template:'simpleBlack',config:{}},layout:'logicalStructure',config:{},view:null},mindMapConfig:{},lang:'zh',localConfig:null};
          window.cleanup=plugin.renderEmbeddedMap({element:document.querySelector('#mount'),content:JSON.stringify(data),setContent:()=>true});
          plugin.positionAll();
          window.details=()=>{const rec=plugin.sessions.values().next().value; const r=rec.root.getBoundingClientRect(),t=document.querySelector('#title').getBoundingClientRect(),a=rec.anchor.getBoundingClientRect();return {
            visibility:rec.root.style.visibility, width:r.width,height:r.height,
            rootTop:r.top, anchorTop:a.top,titleBottom:t.bottom,
            iframeSession:rec.session, css:rec.root.style.cssText,anchorRect:[a.left,a.top,a.right,a.bottom], clipRect:(rec.anchor.closest('.protyle-content')).getBoundingClientRect().toJSON(), pending:rec.slot.classList.contains('smm-inline-slot-pending'),
            overlap:r.top < t.bottom && r.bottom > t.top && r.left<t.right && r.right>t.left,
            ready:rec.editorReady, visibleOnce:rec.visibleOnce
          }};
        }''')
        first=await page.evaluate('details()')
        assert first['visibility']=='hidden' and first['width']>500,first
        assert first['pending'],first
        session=first['iframeSession']
        # Simulate JavaScript completing before the document finishes settling.
        await page.evaluate('''()=>{
          const r=plugin.sessions.values().next().value;
          plugin.handleFrameMessage({origin:location.origin,source:r.frame.contentWindow,data:{channel:'siyuan-mindmap-inline',type:'initialized',session:r.session}})
        }''')
        await page.wait_for_timeout(90)
        during=await page.evaluate('details()')
        assert during['visibility']=='hidden' and during['ready'],during
        # Title grows while loading (e.g. document CSS/theme hydration).
        await page.evaluate("document.querySelector('#title').style.height='240px'")
        await page.wait_for_timeout(360)
        settled=await page.evaluate('details()')
        assert settled['visibility']=='visible' and not settled['overlap'],settled
        assert abs(settled['anchorTop']-settled['rootTop'])<=1,settled
        assert not settled['pending'],settled
        # Simulate invalid/stale SiYuan layout briefly placing anchor in title.
        await page.evaluate("document.querySelector('#map-wrap').style.marginTop='-175px'")
        await page.wait_for_timeout(170)
        collision=await page.evaluate('details()')
        assert collision['visibility']=='hidden' and collision['overlap'],collision
        await page.evaluate("document.querySelector('#map-wrap').style.marginTop='15px'")
        await page.wait_for_timeout(220)
        restored=await page.evaluate('details()')
        assert restored['visibility']=='visible' and not restored['overlap'],restored
        assert restored['iframeSession']==session,restored
        # A document can initially suppress the title, then create/show it
        # after plugin render (e.g. startup hydration or switching tabs).
        await page.evaluate("document.querySelector('#title').style.display='none'")
        await page.wait_for_timeout(80)
        await page.evaluate("document.querySelector('#title').style.display='block'")
        await page.wait_for_timeout(120)
        late_title=await page.evaluate('details()')
        assert not (late_title['visibility']=='visible' and late_title['overlap']),late_title
        assert abs(late_title['anchorTop']-late_title['rootTop'])<=1,late_title
        assert not errors,errors
        print('Startup hidden with correctly sized iframe:',first)
        print('After title settled:',settled)
        print('Bad geometry safely hidden:',collision['visibility'])
        print('After recovery:',restored)
        print('Browser errors:',errors)
        await browser.close()

asyncio.run(main())
