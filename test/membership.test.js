const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../miniprogram/utils/membership-core');
function fixture(extra = {}) { return { confirmed: true, coverageStart: '2026-01-01', coverageEnd: '2026-01-15', membersText: '匿名顾客ID,开卡日期\nA,2026-01-01\nB,2026-01-01\nC,2026-01-10', ordersText: '订单ID,匿名顾客ID,消费日期,实付金额\n1,A,2026-01-03,80\n2,A,2026-01-03,20', ...extra }; }
test('mature cohort retains zero consumers; dates and orders differ', () => { const r=core.analyze(fixture()); assert.equal(r.windows[0].denominator,2); assert.equal(r.windows[0].rate,.5); assert.equal(r.windows[0].immature,1); assert.equal(r.windows[0].orders,2); assert.equal(r.windows[0].consumerDays,1); assert.equal(r.windows[0].amount,'100.00'); });
test('7/14 windows mature independently and exclude opening day', () => { const r=core.analyze(fixture({coverageEnd:'2026-01-09',membersText:'匿名顾客ID,开卡日期\nA,2026-01-01',ordersText:'订单ID,匿名顾客ID,消费日期,实付金额\n1,A,2026-01-01,50\n2,A,2026-01-08,10\n3,A,2026-01-09,20'})); assert.equal(r.windows[0].orders,1); assert.equal(r.windows[1].rate,null); });
test('missing coverage never treated as zero', () => { const r=core.analyze(fixture({coverageStart:'2026-01-03'})); assert.equal(r.windows[0].denominator,0); assert.equal(r.windows[0].missingCoverage,2); assert.equal(r.windows[0].rate,null); });
test('deduplicates identical orders and rejects conflicts', () => { const input=fixture(); const r=core.analyze({...input,ordersText:input.ordersText+'\n1,A,2026-01-03,80'}); assert.equal(r.duplicateOrders,1); assert.equal(r.totalOrders,2); assert.throws(()=>core.analyze({...input,ordersText:input.ordersText+'\n1,A,2026-01-03,81'}),/冲突/); });
test('empty orders preserve mature zero consumers', () => { const r=core.analyze(fixture({ordersText:'订单ID,匿名顾客ID,消费日期,实付金额'})); assert.equal(r.windows[0].rate,0); assert.equal(r.windows[0].zeroConsumers,2); });
test('requires explicit completeness and validates calendar and amount', () => { assert.throws(()=>core.analyze(fixture({confirmed:false})),/确认/); assert.throws(()=>core.analyze(fixture({coverageEnd:'2026-02-30'})),/有效日期/); assert.throws(()=>core.analyze(fixture({ordersText:'订单ID,匿名顾客ID,消费日期,实付金额\n1,A,2026-01-03,-1'})),/非负/); });
test('rejects unknown identities, future cards, duplicate-member conflicts', () => { assert.throws(()=>core.analyze(fixture({ordersText:'订单ID,匿名顾客ID,消费日期,实付金额\n1,Z,2026-01-03,1'})),/顾客表/); assert.throws(()=>core.analyze(fixture({membersText:'匿名顾客ID,开卡日期\nA,2026-02-01'})),/晚于/); assert.throws(()=>core.analyze(fixture({membersText:'匿名顾客ID,开卡日期\nA,2026-01-01\nA,2026-01-02'})),/冲突/); });
test('tab input works and zero-priced verified orders count', () => { const r=core.analyze(fixture({membersText:'匿名顾客ID\t开卡日期\nA\t2026-01-01',ordersText:'订单ID\t匿名顾客ID\t消费日期\t实付金额\n1\tA\t2026-01-02\t0'})); assert.equal(r.windows[0].rate,1); });
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function pageFixture() {
  let page; let modal;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/pages/membership/membership.js'),'utf8'), { require:()=>core, Page:p=>{page=p;}, wx:{showShareMenu(){},showModal:opts=>{modal=opts;},setClipboardData(){}} });
  page.setData=function(update){Object.assign(this.data,update);};
  return {page, getModal:()=>modal};
}
test('editing input clears prior report and completeness confirmation', () => { const {page}=pageFixture(); page.setData(fixture()); page.calculate(); assert.ok(page.data.result); page.onInput({currentTarget:{dataset:{field:'coverageEnd'}},detail:{value:'2026-01-16'}}); assert.equal(page.data.result,null); assert.equal(page.data.confirmed,false); page.calculate(); assert.equal(page.data.result,null); assert.match(page.data.error,/确认/); });
test('template cancel preserves input; share path never includes records', () => { const {page,getModal}=pageFixture(); page.setData(fixture()); const old=page.data.membersText; page.loadTemplate(); getModal().success({confirm:false}); assert.equal(page.data.membersText,old); const share=page.onShareAppMessage(); assert.equal(share.path,'/pages/membership/membership'); assert.equal(Object.keys(share).length,2); });
