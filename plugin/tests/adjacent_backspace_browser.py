"""Chromium DOM integration smoke for SiYuan Backspace boundary guard.
Run: python plugin/tests/adjacent_backspace_browser.py (requires playwright + chromium)
This emulates SiYuan's DOM, not the installed SiYuan application.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / 'plugin/src/index.js').read_text(encoding='utf-8')
start = source.index('function shouldProtectAdjacentMapBackspace(')
end = source.index('\nclass SiYuanMindMapInline extends Plugin {', start)
fn = source[start:end]
html = '''<!doctype html><meta charset="utf-8"><div class="protyle" id="protyle">
<div class="protyle-wysiwyg" id="editor" contenteditable="true">
<div data-node-id="before" data-type="NodeParagraph"><div contenteditable="true" id="before">第一段</div></div>
<div data-node-id="map" data-type="NodeCustomBlock" id="map"><div class="smm-inline-slot" id="slot">导图</div></div>
<div data-node-id="after" data-type="NodeParagraph"><div contenteditable="true" id="after">正文文字</div></div>
<div data-node-id="last" data-type="NodeParagraph"><div contenteditable="true" id="last">末尾</div></div>
</div></div>'''
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    page.set_content(html)
    page.add_script_tag(content=fn + '''
window.guardResults = [];
window.records = new Map([['map', {anchor: document.getElementById('slot'), disposed:false}]]);
document.addEventListener('keydown', event=>{
 const result=shouldProtectAdjacentMapBackspace(event,window.records,window.getSelection());
 window.guardResults.push({key:event.key, result});
 if(result){event.preventDefault();event.stopImmediatePropagation();}
},true);
window.setCaret = (id, offset)=>{
 const el=document.getElementById(id);
 const node=el.firstChild;
 const range=document.createRange(); range.setStart(node,offset);range.collapse(true);
 const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
};
window.fire = (id,key)=>{
 const ev = new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key});
 document.getElementById(id).dispatchEvent(ev);
 return ev.defaultPrevented;
};
''')
    def check(name, actual, expected):
        assert actual == expected, f'{name}: got {actual!r} expected {expected!r}'
        print('PASS:', name)
    check('caret at start immediately after map protected', page.evaluate("setCaret('after',0);fire('after','Backspace')"), True)
    check('Backspace typed prose unchanged', page.evaluate("setCaret('after',2);fire('after','Backspace')"), False)
    check('other paragraph not adjacent', page.evaluate("setCaret('last',0);fire('last','Backspace')"), False)
    check('caret above map is not protected', page.evaluate("setCaret('before',0);fire('before','Backspace')"), False)
    check('Delete not intercepted', page.evaluate("setCaret('after',0);fire('after','Delete')"), False)
    check('selected map is intentionally deletable', page.evaluate("document.getElementById('map').classList.add('protyle-wysiwyg--select');setCaret('after',0);fire('after','Backspace')"), False)
    check('map shell key is delegated to SiYuan', page.evaluate("document.getElementById('map').classList.remove('protyle-wysiwyg--select');let r=document.createRange();r.setStart(document.getElementById('slot'),0);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);fire('slot','Backspace')"), False)
    check('editor-level map boundary is delegated to SiYuan', page.evaluate("let e=document.getElementById('editor');let r=document.createRange();r.setStart(e,Array.from(e.childNodes).indexOf(document.getElementById('map'))+1);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);fire('editor','Backspace')"), False)

    page.evaluate("document.getElementById('after').textContent='\u200b正文文字'")
    check('zero-width placeholder at start', page.evaluate("setCaret('after',1);fire('after','Backspace')"), True)
    browser.close()
