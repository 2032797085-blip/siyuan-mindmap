import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
SOURCE=(ROOT/'index.js').read_text()
CSS=(ROOT/'index.css').read_text()

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=await browser.new_page(viewport={'width':1300,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.set_content('''<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin:0;font:16px sans-serif;background:#eee; }
    .protyle {position:relative; width:850px;height:780px; margin:25px auto; background:#fff;}
    .protyle-content {position:relative;overflow:auto;height:740px;padding:12px;box-sizing:border-box;}
    .protyle-title {height:130px;box-sizing:border-box;border:1px solid #eee;background:#fff;padding:12px;}
    .protyle-wysiwyg { margin-top:15px; }
    .b3-menu {position:fixed;z-index:400;left:355px;top:380px;width:245px;height:220px;background:#fbbc05;color:#222;}
    .protyle-toolbar {position:absolute;z-index:5;left:150px;top:405px;background:#3a8bff;width:330px;height:34px;}
    </style></head><body>
    <div id="protyle" class="protyle"><div class="protyle-content">
      <div id="title" class="protyle-title" contenteditable="true">文档标题</div>
      <div class="protyle-wysiwyg"><div data-node-id="block123"><div id="mount"></div></div><p style="height:150px">导图下面的正文</p></div>
    </div><div class="protyle-toolbar">文字浮动工具栏</div></div>
    <div id="native-menu" class="b3-menu">思源斜杠菜单</div>
    <script>window.exports={};window.siyuan={config:{readonly:false}};
      window.require=(name)=>({Plugin:class{constructor(){this.name='siyuan-mindmap';this.customBlockRenders={};this.storage={}}async loadData(k){return this.storage[k]}async saveData(k,v){this.storage[k]=v}addIcons(){}addToolbarItem(){}addBreadcrumbButton(){}},Setting:class{addItem(){}},showMessage:()=>{}});</script></body></html>''')
    await page.add_style_tag(content=CSS)
    await page.add_script_tag(content=SOURCE)
    await page.evaluate('''async()=>{
      window.plugin = new window.exports.default();
      await window.plugin.onload();
      window.mapContent=JSON.stringify({mindMapData:{root:{data:{text:'test'},children:[]},theme:{template:'simpleBlack',config:{}},layout:'logicalStructure',config:{},view:null},mindMapConfig:{},lang:'zh',localConfig:null});
      window.mountMap=()=>{const host=document.getElementById('mount');host.replaceChildren();window.cleanup=plugin.renderEmbeddedMap({element:host,content:mapContent,setContent:(s)=>{mapContent=s;const cleanup=window.cleanup;if(cleanup)cleanup();mountMap();return true}})};
      window.mountMap();
      const rec=plugin.sessions.values().next().value;
      rec.editorReady=true;
      plugin.schedulePositions();
    }''')
    # Some browser environments disallow navigation from about:blank to absolute /plugins URL;
    # the iframe itself need not load for these host-side stacking tests.
    await page.wait_for_timeout(400)
    first=await page.evaluate('''()=>{
      let r=plugin.sessions.values().next().value;
      let a=r.anchor.getBoundingClientRect(),b=r.root.getBoundingClientRect();
      return {parent:r.root.parentNode.id,topDelta:Math.round(b.top-a.top),z:getComputedStyle(r.root).zIndex,session:r.session}
    }''')
    print('Initial placement:',first)
    assert first['parent']=='protyle', first
    assert abs(first['topDelta'])<=1,first
    menu=await page.evaluate('''()=>{let m=document.querySelector('#native-menu').getBoundingClientRect();return document.elementFromPoint(m.x+20,m.y+100).id}''')
    print('Menu hit test:',menu)
    assert menu=='native-menu',menu
    # Change title height without resizing the map slot; input event must reposition portal.
    await page.evaluate('''()=>{
      const title=document.querySelector('#title');title.style.height='225px';title.dispatchEvent(new Event('input',{bubbles:true}));
    }''')
    await page.wait_for_timeout(80)
    moved=await page.evaluate('''()=>{
      let r=plugin.sessions.values().next().value;
      let a=r.anchor.getBoundingClientRect(),b=r.root.getBoundingClientRect();return {topDelta:Math.round(b.top-a.top),top:Math.round(b.top),slotTop:Math.round(a.top)}
    }''')
    print('After title growth:',moved)
    assert abs(moved['topDelta'])<=1,moved
    # With slash menu dismissed, the selection toolbar must remain accessible.
    await page.evaluate('document.querySelector("#native-menu").style.display="none"')
    toolbar=await page.evaluate('''()=>{let t=document.querySelector('.protyle-toolbar');let r=t.getBoundingClientRect();return document.elementFromPoint(r.x+7,r.y+6).className}''')
    print('Native toolbar hit test:',toolbar)
    assert 'protyle-toolbar' in toolbar,toolbar
    # Save-induced re-render preserves iframe and session.
    before=await page.evaluate('''()=>plugin.sessions.values().next().value.session''')
    await page.evaluate('''()=>{const r=plugin.sessions.values().next().value;r.applyPatch({lang:'en'});r.save()}''')
    await page.wait_for_timeout(80)
    after=await page.evaluate('''()=>plugin.sessions.values().next().value.session''')
    assert before==after,(before,after)
    print('Re-render preserved session:',before==after,'browser JS errors:',errors[:5])
    assert not errors,errors
    await browser.close()

asyncio.run(main())
