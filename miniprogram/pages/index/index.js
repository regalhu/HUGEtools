const calc = require("../../utils/calc");

const today = () => new Date().toISOString().slice(0, 10);

Page({
  data: {
    version: "0.5.0-miniapp",
    tools: [
      { key: "margin", label: "毛利" },
      { key: "deal", label: "团购" },
      { key: "loss", label: "损耗" },
      { key: "xhs", label: "小红书" },
      { key: "schedule", label: "排班" }
    ],
    activeTool: "margin",
    isMargin: true,
    isDeal: false,
    isLoss: false,
    isXhs: false,
    isSchedule: false,
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
    xhs: {
      category: "",
      city: "杭州",
      sellingPoints: "",
      audience: "上班族、女生、夜宵人群",
      style: "种草",
      address: "写字楼附近"
    },
    xhsResult: {},
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
    scheduleResult: {}
  },

  onLoad() {
    this.recalculateAll();
  },

  onToolTap(event) {
    const activeTool = event.currentTarget.dataset.tool;
    this.setData({
      activeTool,
      isMargin: activeTool === "margin",
      isDeal: activeTool === "deal",
      isLoss: activeTool === "loss",
      isXhs: activeTool === "xhs",
      isSchedule: activeTool === "schedule"
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
      xhsResult: calc.generateXhs(this.data.xhs),
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
  }
});
