"""Visual smoke checks of the SiYuan-only compact toolbar CSS on Chromium.
No bundled editor or network dependency required; this checks CSS geometry only.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'web/src/pages/Edit/components/Toolbar.vue').read_text()
start=source.index('/* SiYuan compact toolbar:')
css=source[start:source.rfind('</style>')].replace('/deep/', '')
css=css.replace('min(520px, calc(100vw - 32px))','520px')
html='''<html><head><style>
body{margin:0;background:#f8f8f8;font-family:Arial,sans-serif;}
.toolbarContainer .toolbar{position:fixed;left:50%;transform:translateX(-50%);top:20px;display:flex;width:max-content;z-index:2;}
.toolbarBlock{display:flex;position:relative;background:white;padding:10px 20px;border:1px solid #ddd;}
.toolbarBtn{display:flex;flex-direction:column;justify-content:center;margin-right:20px;text-align:center;}
.toolbarBtn .icon{display:block;width:32px;height:26px;border:1px solid #eee;}
.toolbarNodeBtnList{display:flex;}
''' + css + '''
</style></head><body><div class="toolbarContainer"><div class="toolbar siyuan-compact-toolbar"><div class="toolbarBlock siyuan-compact-block" id="bar">
<div class="toolbarNodeBtnList" id="nodes"></div>
<div class="toolbarBtn siyuan-compact-action" id="more"><span class="icon">⋯</span><span class="text">更多</span></div>
<span class="siyuan-compact-divider"></span>
<div class="toolbarBtn siyuan-compact-action"><span class="icon">□</span><span class="text">文件</span></div>
<div class="toolbarBtn siyuan-compact-action" id="format"><span class="icon">A</span><span class="text">格式</span></div>
<span class="siyuan-compact-divider"></span>
<button type="button" class="siyuan-compact-toggle" id="minimize">− 最小化功能栏</button>
<div class="siyuan-format-host" style="display:none" id="formatPopup"><div class="richTextToolbar"><div class="btn">B</div><div class="btn">I</div></div></div>
</div><button class="siyuan-toolbar-restore" id="restore" style="display:none">☷ 展开功能栏</button></div></div>
<script>
document.querySelector('#minimize').addEventListener('click',()=>{document.querySelector('#bar').style.display='none';document.querySelector('#restore').style.display='block';document.querySelector('.siyuan-compact-toolbar').classList.add('siyuan-toolbar-minimized');document.querySelector('#formatPopup').style.display='none'});
document.querySelector('#restore').addEventListener('click',()=>{document.querySelector('#bar').style.display='flex';document.querySelector('#restore').style.display='none';document.querySelector('.siyuan-compact-toolbar').classList.remove('siyuan-toolbar-minimized')});
const count=window.innerWidth < 620 ? 3 : window.innerWidth < 820 ? 5 : window.innerWidth < 1060 ? 7 : 10;
const node=document.querySelector('#nodes');
for(let i=0;i<count;i++){node.insertAdjacentHTML('beforeend','<div class="toolbarBtn"><span class="icon">◯</span><span class="text">文本</span></div>')}
document.querySelector('#format').addEventListener('click',()=>{const p=document.querySelector('#formatPopup');p.style.display=p.style.display==='none'?'flex':'none'});
</script></body></html>'''
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (1447,1000,760,520,460):
  page=browser.new_page(viewport={'width':width,'height':839})
  page.set_content(html)
  bar=page.locator('#bar').bounding_box()
  toolbar=page.locator('.siyuan-compact-toolbar').bounding_box()
  assert bar and toolbar
  assert 44 <= bar['height'] <= 48, (width,bar)
  assert toolbar['x']>=0 and toolbar['x']+toolbar['width']<=width+1,(width,toolbar)
  assert page.locator('#nodes .toolbarBtn').count()==(3 if width<620 else 5 if width<820 else 7 if width<1060 else 10)
  page.locator('#format').click()
  assert page.locator('#formatPopup').is_visible()
  popup=page.locator('#formatPopup').bounding_box()
  assert popup and popup['y'] >= bar['y']+bar['height']-1
  page.locator('#minimize').click()
  assert page.locator('#restore').is_visible()
  assert not page.locator('#bar').is_visible()
  assert not page.locator('#formatPopup').is_visible()
  minimized=page.locator('.siyuan-compact-toolbar').bounding_box()
  assert 28 <= minimized['height'] <= 34,(width,minimized)
  page.locator('#restore').click()
  assert page.locator('#bar').is_visible()
  assert not page.locator('#restore').is_visible()
  again=page.locator('#bar').bounding_box()
  assert 44 <= again['height'] <= 48,(width,again)
  page.close()
 browser.close()
print('Chromium compact toolbar geometry checks passed: 1447, 1000, 760, 520, 460 px')
