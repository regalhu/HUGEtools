// Local-only, generic cohort analysis. No identities or business records are bundled.
const DAY = 86400000;
function date(value, label) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(label + '须为 YYYY-MM-DD');
  const ms = Date.parse(text + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== text) throw new Error(label + '不是有效日期');
  return ms / DAY;
}
function rows(text, headers) {
  const lines = String(text || '').replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error('请填写' + headers.join('、'));
  const separator = lines[0].includes('\t') ? '\t' : ',';
  const split = line => line.split(separator).map(v => v.trim());
  if (split(lines[0]).join('|') !== headers.join('|')) throw new Error('表头须为：' + headers.join(','));
  if (lines.length > 20001) throw new Error('单表最多 20000 行，请缩小范围');
  return lines.slice(1).map((line, index) => {
    const values = split(line);
    if (values.length !== headers.length || values.some(v => v === '' || /["\t]/.test(v))) throw new Error('第 ' + (index + 2) + ' 行字段不完整；不支持引号或字段内分隔符');
    return values;
  });
}
function analyze(input) {
  if (input.confirmed !== true) throw new Error('请先确认所填覆盖区间的有效订单已完整导入，含零消费顾客');
  const start = date(input.coverageStart, '完整覆盖起日');
  const end = date(input.coverageEnd, '完整覆盖截止日');
  if (start > end) throw new Error('覆盖起日不能晚于截止日');
  const members = new Map(); let duplicateMembers = 0;
  rows(input.membersText, ['匿名顾客ID', '开卡日期']).forEach(([id, opened]) => {
    const day = date(opened, '开卡日期');
    if (day > end) throw new Error('开卡日期晚于分析截止日：' + id);
    if (members.has(id)) {
      if (members.get(id) !== day) throw new Error('同一顾客开卡日期冲突：' + id);
      duplicateMembers++;
    } else members.set(id, day);
  });
  if (!members.size) throw new Error('请至少填写一位顾客；零消费顾客也须列入');
  const orders = new Map(); let duplicateOrders = 0;
  rows(input.ordersText, ['订单ID', '匿名顾客ID', '消费日期', '实付金额']).forEach(([id, member, dayText, amountText]) => {
    const day = date(dayText, '消费日期');
    if (!members.has(member)) throw new Error('订单顾客不在顾客表：' + member);
    if (day < start || day > end) throw new Error('订单日期不在完整覆盖区间：' + id);
    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isSafeInteger(Math.round(Number(amountText) * 100))) throw new Error('实付金额须为非负数且最多两位小数：' + id);
    const order = { id, member, day, cents: Math.round(Number(amountText) * 100) };
    if (orders.has(id)) {
      const old = orders.get(id);
      if (old.member !== member || old.day !== day || old.cents !== order.cents) throw new Error('同一订单ID内容冲突：' + id);
      duplicateOrders++;
    } else orders.set(id, order);
  });
  const byMember = new Map();
  orders.forEach(order => { if (!byMember.has(order.member)) byMember.set(order.member, []); byMember.get(order.member).push(order); });
  const windows = [7, 14].map(days => {
    let denominator = 0, numerator = 0, immature = 0, missingCoverage = 0, count = 0, cents = 0, consumerDays = 0;
    members.forEach((opened, id) => {
      if (opened + days > end) { immature++; return; }
      if (opened + 1 < start) { missingCoverage++; return; }
      denominator++;
      const selected = (byMember.get(id) || []).filter(o => o.day > opened && o.day <= opened + days);
      if (selected.length) numerator++;
      count += selected.length; cents += selected.reduce((s, o) => s + o.cents, 0);
      consumerDays += new Set(selected.map(o => o.day)).size;
    });
    return { days, denominator, numerator, immature, missingCoverage, rate: denominator ? numerator / denominator : null, rateText: denominator ? (100 * numerator / denominator).toFixed(1) + '%' : '暂无可比队列', orders: count, consumerDays, amount: (cents / 100).toFixed(2), zeroConsumers: denominator - numerator };
  });
  return { totalMembers: members.size, totalOrders: orders.size, duplicateMembers, duplicateOrders, windows };
}
module.exports = { analyze, date };
