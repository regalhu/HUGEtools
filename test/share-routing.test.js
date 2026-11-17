const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname,'../miniprogram');
function load(file) { let page; const full=path.join(base,file); vm.runInNewContext(fs.readFileSync(full,'utf8'), { Page:p=>page=p, require:s=>require(path.resolve(path.dirname(full),s)), wx:{}, console }); return page; }
test('all secondary share routes point at registered native pages, never carry records',()=>{
 const routes=JSON.parse(fs.readFileSync(path.join(base,'app.json'))).pages;
 for(const name of ['operations','dish-tracking','data-backup']) {const p=load(`pages/${name}/${name}.js`);const share=p.onShareAppMessage(); assert(routes.includes(share.path.slice(1))); assert(!share.path.includes('?'));}
});
test('home sharing preserves selected tool; launch validates and opens selected tool',()=>{
 const p=load('pages/index/index.js'); p.data=JSON.parse(JSON.stringify(p.data));p.setData=v=>Object.assign(p.data,v);
 p.onToolTap({currentTarget:{dataset:{tool:'margin'}}});assert.equal(p.onShareAppMessage().path,'/pages/index/index?tool=margin');
 const called=[];p.restoreLocalRecords=()=>{};p.recalculateAll=()=>{};p.buildWorkbenchReport=()=>{};p.onToolTap=e=>called.push(e.currentTarget.dataset.tool);
 p.onLoad({tool:'revenue'});p.onLoad({tool:'evil'});assert.deepEqual(called,['revenue']);
});
