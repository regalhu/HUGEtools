const groups = [
  { id: 'operate', title: '日常营运', subtitle: '把每一天，安排得更好。' },
  { id: 'insight', title: '经营分析', subtitle: '看清数字，再做决定。' },
  { id: 'profit', title: '成本与收益', subtitle: '算清每一份投入与回报。' },
  { id: 'grow', title: '增长与开店', subtitle: '从好生意，到更好的生意。' },
  { id: 'personal', title: '数据与分享', subtitle: '安心留存，轻松分享。' }
];
const tools = [
  ['operations','营运工作台','会议、日志、培训与日报','operate','▦'],
  ['operations-center','执行闭环','多人进度与 PDCA 复盘','operate','✓'],
  ['taskReminder','任务提醒','安排门店的每项工作','operate','◷'],
  ['incentive','员工激励','行为评分与积分记录','operate','✦'],
  ['schedule','单店排班','轻量周排班计划','operate','▤'],
  ['revenue','营业额分析','收入、预算与老板简报','insight','↗'],
  ['dish-tracking','菜品跟踪','新品与常规菜趋势','insight','◉'],
  ['membership','会员复购','7 / 14 日成熟队列分析','insight','◎'],
  ['health','经营健康','食材成本与经营诊断','insight','＋'],
  ['margin','菜品毛利','单品、套餐与渠道测算','profit','%'],
  ['loss','损耗记录','金额、原因与责任归类','profit','−'],
  ['yield','应产率与产能','原料利用与出品瓶颈','profit','⇄'],
  ['deal','团购利润','核销、佣金与加购测算','profit','＝'],
  ['site','选址评估','租金、投入与风险判断','grow','⌖'],
  ['recruitment','招募文案','岗位职责与招聘信息','grow','♧'],
  ['xhs','种草内容','标题、正文与拍摄建议','grow','✧'],
  ['dianping','评价与回复','真实评价与商家回复','grow','“'],
  ['data-backup','数据备份','本机导出、核对与恢复','personal','↓'],
  ['share','分享工具','转发、链接与二维码','personal','↗']
].map(([key,title,description,group,icon])=>({key,title,description,group,icon}));
const quick = [
  ['meetings','会议纪要'],['logs','每日日志'],['resources','资料库'],['training','培训反馈'],['report','营运日报']
].map(([view,title])=>({key:'workbench-'+view,view,title}));
const nativePages = {'operations-center':'operations/operations','dish-tracking':'dish-tracking/dish-tracking','data-backup':'data-backup/data-backup','membership':'membership/membership'};
function route(key) {
  const shortcut=quick.find(item=>item.key===key);
  if(shortcut) return '/pages/index/index?tool=operations&view='+shortcut.view;
  if(!tools.some(item=>item.key===key)) return null;
  return nativePages[key] ? '/pages/'+nativePages[key] : '/pages/index/index?tool='+encodeURIComponent(key);
}
function search(query) {
  const value=String(query||'').trim().toLowerCase();
  return groups.map(group=>Object.assign({},group,{tools:tools.filter(t=>t.group===group.id && (!value || [t.title,t.description,t.key,group.title].join(' ').toLowerCase().includes(value)))})).filter(group=>group.tools.length);
}
module.exports={groups,tools,quick,route,search};
