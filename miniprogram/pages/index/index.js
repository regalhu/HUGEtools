const calc = require("../../utils/calc");

const today = () => new Date().toISOString().slice(0, 10);

Page({
  data: {
    version: "0.8.0-miniapp.1",
    tools: [
      { key: "operations", label: "工作台" },
      { key: "margin", label: "毛利" },
      { key: "loss", label: "损耗" },
      { key: "yield", label: "应产率" },
      { key: "health", label: "经营健康" },
      { key: "revenue", label: "营业额" },
      { key: "site", label: "选址" },
      { key: "recruitment", label: "招募" },
      { key: "deal", label: "团购" },
      { key: "xhs", label: "种草" },
      { key: "dianping", label: "评价" },
      { key: "taskReminder", label: "任务" },
      { key: "incentive", label: "激励" },
      { key: "schedule", label: "排班" },
      { key: "share", label: "分享" }
    ],
    activeTool: "operations",
    isOperations: true,
    isMargin: false,
    isDeal: false,
    isLoss: false,
    isYield: false,
    isHealth: false,
    isRevenue: false,
    isSite: false,
    isRecruitment: false,
    isXhs: false,
    isDianping: false,
    isTaskReminder: false,
    isIncentive: false,
    isSchedule: false,
    isShare: false,
    workbenchViews: [
      { key: "overview", label: "总览" },
      { key: "meetings", label: "会议" },
      { key: "logs", label: "日志" },
      { key: "resources", label: "资料" },
      { key: "training", label: "培训" },
      { key: "report", label: "日报" }
    ],
    workbenchView: "overview",
    isWorkbenchOverview: true,
    isWorkbenchMeetings: false,
    isWorkbenchLogs: false,
    isWorkbenchResources: false,
    isWorkbenchTraining: false,
    isWorkbenchReport: false,
    meetingForm: {
      date: today(),
      period: "上午",
      title: "",
      topic: "",
      owner: "",
      dueDate: today(),
      progress: "待开始"
    },
    logForm: {
      date: today(),
      completed: "",
      issue: "",
      next: ""
    },
    resourceForm: {
      category: "营运标准",
      title: "",
      content: "",
      source: ""
    },
    trainingForm: {
      date: today(),
      session: "",
      trainer: "",
      score: 5,
      retrain: "否",
      feedback: ""
    },
    meetingRecords: [],
    logRecords: [],
    resourceRecords: [],
    trainingRecords: [],
    workbenchReport: "",
    marginTypeOptions: [
      { label: "单品", value: "single" },
      { label: "套餐", value: "combo" },
      { label: "礼品", value: "gift" }
    ],
    sceneOptions: [
      { label: "堂食", platformRate: 0, fulfillmentFee: 0, activityCost: 0, promotionCost: 0 },
      { label: "外带", platformRate: 0, fulfillmentFee: 0, activityCost: 0, promotionCost: 0 },
      { label: "外卖", platformRate: 8, fulfillmentFee: 4.5, activityCost: 2, promotionCost: 1 },
      { label: "团购", platformRate: 6, fulfillmentFee: 0, activityCost: 1, promotionCost: 0 }
    ],
    margin: {
      typeIndex: 0,
      sceneIndex: 0,
      name: "",
      spec: "",
      price: "",
      mainCost: "",
      sideCost: "",
      packCost: "",
      seasoningCost: "",
      platformRate: 0,
      fulfillmentFee: 0,
      discountRate: 0,
      activityCost: 0,
      promotionCost: 0,
      overheadCost: "",
      floor: 55
    },
    marginSceneLabel: "堂食",
    marginTypeLabel: "单品",
    activeMarginType: "single",
    marginResult: {},
    combo: {
      name: "",
      price: "",
      itemProfit1: "",
      itemProfit2: "",
      itemProfit3: "",
      itemProfit4: "",
      extraPackCost: "",
      giftCost: ""
    },
    comboResult: {},
    gift: {
      name: "",
      price: "",
      baseCost: "",
      packCost: "",
      otherCost: ""
    },
    giftResult: {},
    savedItems: [],
    deal: {
      name: "",
      price: "",
      foodCost: "",
      packCost: "",
      laborCost: "",
      otherCost: "",
      platformRate: 6,
      creatorRate: 8,
      paymentRate: 0.6,
      subsidy: 1,
      refundRate: 3,
      breakageRate: 6,
      soldCount: 380,
      checkedCount: 300,
      addOnRate: 20,
      addOnValue: 12,
      addOnMarginRate: 60,
      repeatRate: 8,
      repeatValue: 35,
      repeatMarginRate: 55
    },
    dealResult: {},
    lossForm: {
      date: today(),
      item: "",
      qty: "",
      unit: "",
      unitCost: "",
      reason: "",
      owner: ""
    },
    lossRecords: [],
    lossResult: {},
    yieldForm: {
      materialName: "鸡腿肉",
      purchaseWeight: 10,
      purchaseCost: 180,
      yieldRate: 72,
      lossRate: 5,
      productName: "招牌鸡腿饭",
      usageGram: 120,
      sellingPrice: 28
    },
    yieldResult: {},
    health: {
      revenue: "",
      openingInventory: "",
      periodPurchases: "",
      endingInventory: "",
      includeTrackedLoss: true,
      manualLossCost: "",
      compCost: "",
      staffMealCost: "",
      surplusCost: "",
      laborCost: "",
      theoreticalFoodCost: "",
      foodRedline: 35,
      primeRedline: 65
    },
    healthResult: {},
    revenue: {
      fileName: "多店营业额.xlsx",
      storeMasterText: "门店,地域,城市,市场层级\n宝山共康,上海区域,上海,成熟市场\n金山百联,上海区域,上海,成长市场",
      revenueText: "门店,日期,折后营业收入,到手收入,订单数\n宝山共康绿地,2026-06-05,12800,11600,310\n宝山共康绿地,2026-06-06,13600,12240,328\n金沙百联,2026-06-01,9600,8640,220",
      budgetText: "门店,月份,到手收入预算\n宝山共康,2026-06,420000\n金山百联,2026-06,300000",
      dishText: "门店,日期,菜品,主菜单,销售金额\n宝山共康,2026-06-05,招牌辣子鸡,是,4200\n宝山共康,2026-06-06,口水鸡,是,3100\n金山百联,2026-06-01,宫保鸡丁,是,5600"
    },
    revenueResult: {},
    site: {
      avgTicket: 45,
      dailyOrders: 120,
      businessDays: 30,
      grossMarginRate: 62,
      monthlyRent: 18000,
      propertyFee: 1200,
      laborCost: 28000,
      utilitiesCost: 4500,
      marketingCost: 3000,
      transferFee: 60000,
      decorationCost: 120000,
      equipmentCost: 50000,
      depositMonths: 2,
      license: true,
      exhaust: true,
      waterDrainage: true,
      trafficScore: 4,
      customerScore: 4,
      competitionScore: 3,
      visibilityScore: 4
    },
    siteResult: {},
    recruitment: {
      category: "快餐简餐",
      rank: "服务员",
      format: "门店海报",
      company: "胡哥餐饮",
      location: "门店附近",
      count: "2 人",
      salary: "4500-6500 元/月",
      schedule: "早晚轮班，月休 4 天",
      benefits: "包吃,绩效奖金,晋升培训",
      contact: "店长",
      phone: ""
    },
    recruitmentResult: {},
    xhsTemplateOptions: [
      "地域搜索攻略",
      "性价比清单",
      "真实探店记录",
      "工作餐推荐",
      "夜宵场景",
      "约会聚餐",
      "亲子家庭",
      "健康轻负担",
      "新品互动",
      "避坑测评"
    ],
    xhs: {
      templateIndex: 0,
      category: "",
      city: "杭州",
      sellingPoints: "",
      audience: "上班族、女生、夜宵人群",
      style: "种草",
      address: "写字楼附近"
    },
    xhsResult: {},
    dianping: {
      mode: "customer",
      category: "门店",
      items: "",
      visitDate: "",
      spend: "",
      sentiment: "positive",
      taste: "",
      service: "",
      issues: "",
      focus: ""
    },
    dianpingResult: {},
    taskForm: {
      name: "闭店检查",
      role: "店长",
      dueDate: today(),
      dueTime: "22:00",
      priority: "高",
      frequency: "每天",
      note: "检查水电气、冷柜温度、门店卫生和现金交接。"
    },
    taskRecords: [],
    taskResult: {},
    incentiveForm: {
      employee: "",
      role: "前厅",
      taskName: "今日任务",
      onTimeScore: 90,
      qualityScore: 90,
      completionScore: 95,
      basePoints: 10
    },
    incentiveRecords: [],
    incentiveResult: {},
    schedule: {
      openTime: "10:00",
      closeTime: "22:00",
      employees: "店长,小王,小李,小张,兼职A",
      roles: "收银,出餐,后厨,洗消,店长",
      peakTimes: "11:30-13:30,17:30-20:00",
      dailyHours: 8,
      restDays: 1,
      hasPartTime: true
    },
    scheduleResult: {},
    share: {
      title: "胡哥餐饮工具箱",
      path: "pages/index/index",
      scene: "share=home",
      publicUrl: "http://113.249.104.188:18089/",
      serverBaseUrl: "http://113.249.104.188:18089",
      status: "可直接点“转发给微信好友”。小程序码需要云服务器配置 WECHAT_APPID 和 WECHAT_APPSECRET 后生成。",
      miniCodeImage: ""
    }
  },

  onLoad() {
    if (wx.showShareMenu) {
      wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    }
    this.restoreLocalRecords();
    this.recalculateAll();
    this.buildWorkbenchReport();
  },

  onShareAppMessage() {
    return {
      title: this.data.share.title,
      path: `${this.data.share.path}?scene=${encodeURIComponent(this.data.share.scene)}`,
      imageUrl: ""
    };
  },

  onShareTimeline() {
    return {
      title: this.data.share.title,
      query: `scene=${encodeURIComponent(this.data.share.scene)}`
    };
  },

  onToolTap(event) {
    const activeTool = event.currentTarget.dataset.tool;
    this.setData({
      activeTool,
      isOperations: activeTool === "operations",
      isMargin: activeTool === "margin",
      isDeal: activeTool === "deal",
      isLoss: activeTool === "loss",
      isYield: activeTool === "yield",
      isHealth: activeTool === "health",
      isRevenue: activeTool === "revenue",
      isSite: activeTool === "site",
      isRecruitment: activeTool === "recruitment",
      isXhs: activeTool === "xhs",
      isDianping: activeTool === "dianping",
      isTaskReminder: activeTool === "taskReminder",
      isIncentive: activeTool === "incentive",
      isSchedule: activeTool === "schedule",
      isShare: activeTool === "share"
    });
  },

  onWorkbenchViewTap(event) {
    const view = event.currentTarget.dataset.view;
    this.setData({
      workbenchView: view,
      isWorkbenchOverview: view === "overview",
      isWorkbenchMeetings: view === "meetings",
      isWorkbenchLogs: view === "logs",
      isWorkbenchResources: view === "resources",
      isWorkbenchTraining: view === "training",
      isWorkbenchReport: view === "report"
    }, () => {
      if (view === "report") this.buildWorkbenchReport();
    });
  },

  openTool(event) {
    const activeTool = event.currentTarget.dataset.tool;
    this.onToolTap({ currentTarget: { dataset: { tool: activeTool } } });
  },

  restoreLocalRecords() {
    try {
      const stored = wx.getStorageSync("hugetools.operations.v1") || {};
      this.setData({
        meetingRecords: stored.meetingRecords || [],
        logRecords: stored.logRecords || [],
        resourceRecords: stored.resourceRecords || [],
        trainingRecords: stored.trainingRecords || [],
        taskRecords: stored.taskRecords || [],
        incentiveRecords: stored.incentiveRecords || []
      });
    } catch {
      wx.showToast({ title: "本地记录读取失败", icon: "none" });
    }
  },

  persistLocalRecords() {
    wx.setStorageSync("hugetools.operations.v1", {
      meetingRecords: this.data.meetingRecords,
      logRecords: this.data.logRecords,
      resourceRecords: this.data.resourceRecords,
      trainingRecords: this.data.trainingRecords,
      taskRecords: this.data.taskRecords,
      incentiveRecords: this.data.incentiveRecords
    });
  },

  addMeetingRecord() {
    const form = this.data.meetingForm;
    if (!form.title) return wx.showToast({ title: "请填写会议名称", icon: "none" });
    const meetingRecords = [{ id: Date.now(), ...form }, ...this.data.meetingRecords];
    this.setData({
      meetingRecords,
      "meetingForm.title": "",
      "meetingForm.topic": "",
      "meetingForm.owner": ""
    }, () => {
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
  },

  addLogRecord() {
    const form = this.data.logForm;
    if (!form.completed) return wx.showToast({ title: "请填写今日完成", icon: "none" });
    const logRecords = [{ id: Date.now(), ...form }, ...this.data.logRecords];
    this.setData({
      logRecords,
      "logForm.completed": "",
      "logForm.issue": "",
      "logForm.next": ""
    }, () => {
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
  },

  addResourceRecord() {
    const form = this.data.resourceForm;
    if (!form.title) return wx.showToast({ title: "请填写资料标题", icon: "none" });
    const resourceRecords = [{ id: Date.now(), ...form }, ...this.data.resourceRecords];
    this.setData({
      resourceRecords,
      "resourceForm.title": "",
      "resourceForm.content": "",
      "resourceForm.source": ""
    }, () => this.persistLocalRecords());
  },

  addTrainingRecord() {
    const form = this.data.trainingForm;
    if (!form.session) return wx.showToast({ title: "请填写培训主题", icon: "none" });
    const trainingRecords = [{ id: Date.now(), ...form }, ...this.data.trainingRecords];
    this.setData({
      trainingRecords,
      "trainingForm.session": "",
      "trainingForm.trainer": "",
      "trainingForm.feedback": ""
    }, () => {
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
  },

  deleteWorkbenchRecord(event) {
    const collection = event.currentTarget.dataset.collection;
    const id = Number(event.currentTarget.dataset.id);
    const current = this.data[collection] || [];
    this.setData({ [collection]: current.filter((item) => item.id !== id) }, () => {
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
  },

  buildWorkbenchReport() {
    const reportDate = today();
    const meetings = this.data.meetingRecords.filter((item) => item.date === reportDate);
    const logs = this.data.logRecords.filter((item) => item.date === reportDate);
    const training = this.data.trainingRecords.filter((item) => item.date === reportDate);
    const pendingTasks = this.data.taskRecords.filter((item) => item.status !== "done").length;
    const report = [
      `胡哥餐饮工具｜每日营运简报｜${reportDate.replace(/-/g, "")}`,
      "",
      `当日会议 ${meetings.length} 场；日志 ${logs.length} 条；培训反馈 ${training.length} 条；待完成任务 ${pendingTasks} 项。`,
      "",
      "会议与议题：",
      ...(meetings.length ? meetings.map((item, index) => `${index + 1}. ${item.title}（${item.period}）｜${item.topic || "未填写议题"}｜负责人 ${item.owner || "未指定"}｜进度 ${item.progress}`) : ["当日无会议记录。"]),
      "",
      "工作日志：",
      ...(logs.length ? logs.map((item, index) => `${index + 1}. 完成：${item.completed}｜问题：${item.issue || "无记录"}｜明日：${item.next || "未填写"}`) : ["当日无日志记录。"]),
      "",
      "培训反馈：",
      ...(training.length ? training.map((item, index) => `${index + 1}. ${item.session}｜${item.score} 分｜需复训 ${item.retrain}｜${item.feedback || "未填写反馈"}`) : ["当日无培训反馈。"]),
      "",
      "口径说明：只汇总本机微信中的本地记录；缺失数据不按 0 推断。"
    ].join("\n");
    this.setData({ workbenchReport: report });
  },

  copyWorkbenchReport() {
    wx.setClipboardData({
      data: this.data.workbenchReport,
      success: () => wx.showToast({ title: "日报已复制", icon: "success" })
    });
  },

  onInput(event) {
    const section = event.currentTarget.dataset.section;
    const field = event.currentTarget.dataset.field;
    const type = event.currentTarget.dataset.type;
    const raw = event.detail.value;
    const value = type === "number" ? Number(raw) : raw;
    this.setData({ [`${section}.${field}`]: value }, () => this.recalculateAll());
  },

  onPickerChange(event) {
    const section = event.currentTarget.dataset.section;
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value);
    this.setData({ [`${section}.${field}`]: value }, () => {
      if (section === "margin" && field === "sceneIndex") this.applySceneTemplate();
      else this.recalculateAll();
    });
  },

  onSwitchChange(event) {
    const section = event.currentTarget.dataset.section;
    const field = event.currentTarget.dataset.field;
    this.setData({ [`${section}.${field}`]: Boolean(event.detail.value) }, () => this.recalculateAll());
  },

  onMarginTypeTap(event) {
    const typeIndex = Number(event.currentTarget.dataset.index);
    this.setData({ "margin.typeIndex": typeIndex }, () => this.recalculateAll());
  },

  applySceneTemplate() {
    const option = this.data.sceneOptions[this.data.margin.sceneIndex] || this.data.sceneOptions[0];
    this.setData({
      "margin.platformRate": option.platformRate,
      "margin.fulfillmentFee": option.fulfillmentFee,
      "margin.activityCost": option.activityCost,
      "margin.promotionCost": option.promotionCost
    }, () => this.recalculateAll());
  },

  recalculateAll() {
    const marginType = this.data.marginTypeOptions[this.data.margin.typeIndex] || this.data.marginTypeOptions[0];
    const scene = this.data.sceneOptions[this.data.margin.sceneIndex] || this.data.sceneOptions[0];
    this.setData({
      marginTypeLabel: marginType.label,
      activeMarginType: marginType.value,
      marginSceneLabel: scene.label,
      marginResult: calc.calculateMargin(this.data.margin),
      comboResult: calc.calculateCombo(this.data.combo),
      giftResult: calc.calculateGift(this.data.gift),
      dealResult: calc.calculateDeal(this.data.deal),
      lossResult: calc.summarizeLoss(this.data.lossRecords),
      yieldResult: calc.calculateYield(this.data.yieldForm),
      healthResult: calc.calculateHealth(this.data.health, this.data.lossRecords),
      revenueResult: calc.analyzeRevenue(this.data.revenue),
      siteResult: calc.calculateSite(this.data.site),
      recruitmentResult: calc.generateRecruitment(this.data.recruitment),
      xhsResult: calc.generateXhs(this.data.xhs),
      dianpingResult: calc.generateDianping(this.data.dianping),
      taskResult: calc.summarizeTasks(this.data.taskRecords),
      incentiveResult: calc.calculateIncentive(this.data.incentiveRecords),
      scheduleResult: calc.generateSchedule(this.data.schedule)
    });
  },

  addCurrentMarginItem() {
    const type = this.data.activeMarginType;
    let item;
    if (type === "combo") {
      item = {
        type: "套餐",
        name: this.data.combo.name || "未命名套餐",
        profit: this.data.comboResult.profit,
        rate: this.data.comboResult.rate,
        note: `单品毛利合计 ${calc.money(this.data.comboResult.itemProfitTotal)}`
      };
    } else if (type === "gift") {
      item = {
        type: "礼品",
        name: this.data.gift.name || "未命名礼品",
        profit: this.data.giftResult.profit,
        rate: this.data.giftResult.rate,
        note: `礼品总成本 ${calc.money(this.data.giftResult.cost)}`
      };
    } else {
      item = {
        type: "菜品",
        name: this.data.margin.name || "未命名菜品",
        profit: this.data.marginResult.materialProfit,
        rate: this.data.marginResult.materialRate,
        note: `原料成本 ${calc.money(this.data.marginResult.materialCost)}`
      };
    }
    const savedItems = this.data.savedItems.concat({
      id: Date.now(),
      priceText: type === "combo" ? calc.money(this.data.combo.price) : type === "gift" ? calc.money(this.data.gift.price) : calc.money(this.data.margin.price),
      profitText: calc.money(item.profit),
      rateText: calc.percentText(item.rate),
      ...item
    });
    this.setData({ savedItems });
    wx.showToast({ title: "已添加", icon: "success" });
  },

  clearSavedItems() {
    this.setData({ savedItems: [] });
  },

  addLossRecord() {
    const form = this.data.lossForm;
    if (!form.item || !Number(form.qty) || !Number(form.unitCost)) {
      wx.showToast({ title: "请补齐损耗信息", icon: "none" });
      return;
    }
    const record = {
      id: Date.now(),
      ...form,
      amount: calc.cents((Number(form.qty) || 0) * (Number(form.unitCost) || 0)),
      amountText: calc.money((Number(form.qty) || 0) * (Number(form.unitCost) || 0))
    };
    this.setData({ lossRecords: [record].concat(this.data.lossRecords) }, () => this.recalculateAll());
    wx.showToast({ title: "已记录", icon: "success" });
  },

  deleteSavedItem(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({
      savedItems: this.data.savedItems.filter((item) => item.id !== id)
    });
  },

  deleteLossRecord(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({
      lossRecords: this.data.lossRecords.filter((item) => item.id !== id)
    }, () => this.recalculateAll());
  },

  copyXhsPost() {
    wx.setClipboardData({
      data: this.data.xhsResult.copyText,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  copyRecruitment() {
    wx.setClipboardData({
      data: this.data.recruitmentResult.draft,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  copyDianping() {
    wx.setClipboardData({
      data: this.data.dianpingResult.draft,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  addTaskRecord() {
    const form = this.data.taskForm;
    if (!form.name || !form.role) {
      wx.showToast({ title: "请补齐任务名称和角色", icon: "none" });
      return;
    }
    const taskRecords = [{
      id: Date.now(),
      status: "pending",
      ...form
    }].concat(this.data.taskRecords);
    this.setData({ taskRecords }, () => {
      this.recalculateAll();
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
    wx.showToast({ title: "已新增任务", icon: "success" });
  },

  completeTaskRecord(event) {
    const id = Number(event.currentTarget.dataset.id);
    const taskRecords = this.data.taskRecords.map((item) => item.id === id ? { ...item, status: "done" } : item);
    this.setData({ taskRecords }, () => {
      this.recalculateAll();
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
  },

  deleteTaskRecord(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({
      taskRecords: this.data.taskRecords.filter((item) => item.id !== id)
    }, () => {
      this.recalculateAll();
      this.persistLocalRecords();
      this.buildWorkbenchReport();
    });
  },

  addIncentiveRecord() {
    const form = this.data.incentiveForm;
    if (!form.employee || !form.taskName) {
      wx.showToast({ title: "请补齐员工和任务", icon: "none" });
      return;
    }
    const scored = calc.scoreIncentive(form);
    const incentiveRecords = [{
      id: Date.now(),
      ...form,
      score: scored.score,
      points: scored.points
    }].concat(this.data.incentiveRecords);
    this.setData({ incentiveRecords }, () => {
      this.recalculateAll();
      this.persistLocalRecords();
    });
    wx.showToast({ title: "已评分", icon: "success" });
  },

  deleteIncentiveRecord(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({
      incentiveRecords: this.data.incentiveRecords.filter((item) => item.id !== id)
    }, () => {
      this.recalculateAll();
      this.persistLocalRecords();
    });
  },

  copyMiniProgramPath() {
    const data = `${this.data.share.path}?scene=${encodeURIComponent(this.data.share.scene)}`;
    wx.setClipboardData({
      data,
      success: () => wx.showToast({ title: "已复制路径", icon: "success" })
    });
  },

  copyPublicShareUrl() {
    wx.setClipboardData({
      data: this.data.share.publicUrl,
      success: () => wx.showToast({ title: "已复制链接", icon: "success" })
    });
  },

  generateMiniProgramCode() {
    const endpoint = `${this.data.share.serverBaseUrl.replace(/\/$/, "")}/api/miniprogram-code`;
    this.setData({ "share.status": "正在请求云服务器生成小程序码..." });
    wx.request({
      url: endpoint,
      method: "POST",
      data: {
        page: this.data.share.path,
        scene: this.data.share.scene
      },
      success: (response) => {
        const payload = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && payload.imageBase64) {
          this.setData({
            "share.miniCodeImage": `data:${payload.contentType || "image/png"};base64,${payload.imageBase64}`,
            "share.status": "小程序码已生成，可长按图片保存或转发。"
          });
          return;
        }
        this.setData({
          "share.status": payload.message || "云服务器暂未配置微信小程序码生成能力，请先使用原生转发。"
        });
      },
      fail: () => {
        this.setData({
          "share.status": "无法连接云服务器生成小程序码。请确认开发工具已允许请求，且服务器域名/HTTPS 已配置。"
        });
      }
    });
  }
});
