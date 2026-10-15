// Restrict ordinary clipboard actions; this is a UI restriction, not data security.
export function installContentGuard(notify){
 const shareLink=e=>e.target instanceof Element&&e.target.closest('.share-url');
 const blocked=()=>notify('页面内容不支持复制粘贴，可使用「分享查询」分享。');
 for(const type of ['copy','cut','paste'])document.addEventListener(type,e=>{
  if(type==='copy'&&shareLink(e))return;
  e.preventDefault();blocked();
 },true);
 document.addEventListener('contextmenu',e=>{if(shareLink(e))return;e.preventDefault();blocked();},true);
 document.addEventListener('selectstart',e=>{
  if(e.target instanceof Element&&e.target.closest('input,textarea,[contenteditable="true"]'))return;
  e.preventDefault();
 },true);
 document.addEventListener('dragstart',e=>{if(e.target instanceof Element&&e.target.closest('img'))e.preventDefault();},true);
 document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase(),modifier=e.ctrlKey||e.metaKey;
  const clipboardShortcut=modifier&&['c','x','v'].includes(key)||e.ctrlKey&&key==='insert'||e.shiftKey&&['insert','delete'].includes(key);
  if(!clipboardShortcut)return;
  if(shareLink(e)&&modifier&&key==='c')return;
  e.preventDefault();blocked();
 },true);
}
