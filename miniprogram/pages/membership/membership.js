const core = require('../../utils/membership-core');
Page({
  data: { membersText: '', ordersText: '', coverageStart: '', coverageEnd: '', confirmed: false, result: null, error: '' },
  onLoad() { wx.showShareMenu({ menus: ['shareAppMessage'] }); },
  onInput(event) { const field = event.currentTarget.dataset.field; if (['membersText', 'ordersText', 'coverageStart', 'coverageEnd'].includes(field)) this.setData({ [field]: event.detail.value, result: null, error: '', confirmed: false }); },
  onConfirm(event) { this.setData({ confirmed: event.detail.value.includes('complete'), result: null, error: '' }); },
  calculate() { try { this.setData({ result: core.analyze(this.data), error: '' }); } catch (error) { this.setData({ result: null, error: error.message }); } },
  loadTemplate() { wx.showModal({ title: '载入演示数据', content: '将替换当前输入，仅为虚构示例，不是门店真实记录。', success: res => { if (res.confirm) this.setData({ membersText: '匿名顾客ID,开卡日期\n示例A,2026-01-01\n示例B,2026-01-01\n示例C,2026-01-10', ordersText: '订单ID,匿名顾客ID,消费日期,实付金额\n示例订单1,示例A,2026-01-03,80\n示例订单2,示例A,2026-01-03,20', coverageStart: '2026-01-01', coverageEnd: '2026-01-15', confirmed: false, result: null, error: '已载入虚构示例。请核对覆盖范围后勾选确认。' }); } }); },
  copyResult() { if (!this.data.result) return; const r = this.data.result; const text = ['会员活动复购分析', '覆盖：' + this.data.coverageStart + ' 至 ' + this.data.coverageEnd, '顾客数：' + r.totalMembers, ...r.windows.map(w => `${w.days}日：${w.numerator}/${w.denominator} = ${w.rateText}；零消费${w.zeroConsumers}人；未成熟${w.immature}人；覆盖不足${w.missingCoverage}人；${w.orders}笔订单/${w.consumerDays}个顾客消费日；实付${w.amount}元`), '开卡次日起计算；仅描述已导入队列，不代表会员活动因果增量。'].join('\n'); wx.setClipboardData({ data: text, fail: () => this.setData({ error: '复制未完成，请重试。' }) }); },
  onShareAppMessage() { return { title: '胡哥餐饮工具 · 会员活动复购分析', path: '/pages/membership/membership' }; }
});
