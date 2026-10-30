"""Host-only test: saved map is visible from first mount, and swaps to iframe safely."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
JS=(ROOT/'index.js').read_text()
CSS=(ROOT/'index.css').read_text()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1350,'height':900})
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  await page.set_content('''<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px sans-serif;background:#f5f5f5}.protyle{width:1000px;height:820px;margin:12px auto;position:relative;background:white}
  .protyle-content{padding:10px;overflow:auto;height:800px;box-sizing:border-box}
  .protyle-title{height:145px;background:#fafafa;border:1px solid #ddd;padding:15px;box-sizing:border-box;font-size:26px}
  .protyle-wysiwyg{padding-top:16px}
  </style></head><body><div class="protyle"><div class="protyle-content">
  <div class="protyle-title">标题在上方</div><div class="protyle-wysiwyg"><div data-node-id="block"><div id="mount"></div></div></div>
  </div></div><script>window.exports={};window.siyuan={config:{readonly:false}};
  window.require=name=>({Plugin:class{constructor(){this.name='siyuan-mindmap';this.customBlockRenders={};this.storage={}}async loadData(k){return this.storage[k]}async saveData(k,v){this.storage[k]=v}addIcons(){}addToolbarItem(){}addBreadcrumbButton(){}},Setting:class{addItem(){}},showMessage:()=>{}});
  </script></body></html>''')
  await page.add_style_tag(content=CSS)
  await page.add_script_tag(content=JS)
  await page.evaluate('''async()=>{
    window.plugin=new window.exports.default(); await plugin.onload();
    const data=plugin.constructor ? window.exports.__test.blankMap('夏洛特烦恼') : {};
    data.mindMapData.root.children=[{data:{text:'主题一'},children:[{data:{text:'子主题A'},children:[]}]},{data:{text:'主题二'},children:[]}];
    window.oldCleanup=plugin.renderEmbeddedMap({element:document.querySelector('#mount'),content:JSON.stringify(data),setContent:()=>true});
    plugin.positionAll();
    window.state=()=>{
      const r=plugin.sessions.values().next().value;
      return {visible:r.root.style.visibility,editorReady:r.editorReady,pending:r.slot.classList.contains('smm-inline-slot-pending'),previewDisplay:getComputedStyle(r.slot.querySelector('.smm-inline-preview')).display, texts:Array.from(r.slot.querySelectorAll('.smm-inline-preview text')).map(x=>x.textContent), svg:r.slot.querySelector('svg')?.outerHTML, titleBottom:document.querySelector('.protyle-title').getBoundingClientRect().bottom, slotTop:r.slot.getBoundingClientRect().top,frameSession:r.session}
    }
  }''')
  start=await page.evaluate('state()')
  assert start['visible']=='hidden',start
  assert start['pending'] and start['previewDisplay']=='flex',start
  assert start['texts']==['夏洛特烦恼','主题一','子主题A','主题二'],start
  assert start['slotTop']>start['titleBottom'],start
  assert '正在准备思维导图' not in await page.locator('body').inner_text()
  await page.screenshot(path=str(ROOT/'tests/instant-preview.png'))
  # Delayed title hydration: content preview is still in proper document flow.
  await page.evaluate("document.querySelector('.protyle-title').style.height='245px'")
  await page.wait_for_timeout(90)
  before_ready=await page.evaluate('state()')
  assert before_ready['visible']=='hidden' and before_ready['previewDisplay']=='flex',before_ready
  assert before_ready['slotTop'] > before_ready['titleBottom'],before_ready
  session=before_ready['frameSession']
  await page.evaluate('''()=>{const r=plugin.sessions.values().next().value;
     plugin.handleFrameMessage({origin:location.origin,source:r.frame.contentWindow,data:{channel:'siyuan-mindmap-inline',type:'initialized',session:r.session}})
  }''')
  await page.wait_for_timeout(400)
  after=await page.evaluate('state()')
  assert after['editorReady'] and after['visible']=='visible',after
  assert not after['pending'] and after['previewDisplay']=='none',after
  assert after['frameSession']==session,after
  # Malicious node text must only appear as text, never real HTML.
  await page.evaluate('''()=>{const fake=document.createElement('div');
     const map=window.exports.__test.blankMap('<img src=x onerror=alert(1)>HELLO');
     window.exports.__test.appendMindMapPreview(fake,map);
     window.__malicious={text:fake.querySelector('svg text').textContent,images:fake.querySelectorAll('img').length}
  }''')
  malicious=await page.evaluate('window.__malicious')
  assert malicious['images']==0 and malicious['text']=='HELLO',malicious
  assert not errors,errors
  print('At first mount: preview labels=',start['texts'])
  print('After late title: preview still visible in correct block position')
  print('After ready: iframe visible, preview hidden, original session retained')
  print('XSS-safe preview:',malicious)
  await browser.close()

asyncio.run(main())
