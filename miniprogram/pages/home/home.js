const catalog = require('../../utils/tool-catalog');
Page({
  data: { version:'3.0', hasLogo:true, logoPath:'/assets/brand-logo.jpg', query:'', groups:catalog.search(''), quick:catalog.quick, toolCount:catalog.tools.length, resultCount:catalog.tools.length, error:'' },
  onLoad() { if(wx.showShareMenu) wx.showShareMenu({menus:['shareAppMessage','shareTimeline']}); },
  onShow() { this._opening=false; },
  onSearch(event) { const query=event.detail.value;const groups=catalog.search(query);this.setData({query,groups,resultCount:groups.reduce((sum,g)=>sum+g.tools.length,0),error:''}); },
  clearSearch() { this.setData({query:'',groups:catalog.search(''),resultCount:catalog.tools.length,error:''}); },
  openTool(event) {
    const url=catalog.route(event.currentTarget.dataset.key);
    if(!url || this._opening) return;
    this._opening=true;this.setData({error:''});
    wx.navigateTo({url,fail:()=>{this._opening=false;this.setData({error:'暂时未能打开，请重试。你的本机记录没有变化。'});},complete:()=>{this._opening=false;}});
  },
  onLogoError() {this.setData({hasLogo:false});},
  onShareAppMessage() {return {title:'胡哥餐饮工具 · 把经营理清楚',path:'/pages/home/home'};},
  onShareTimeline() {return {title:'胡哥餐饮工具 · 把经营理清楚',query:''};}
});
