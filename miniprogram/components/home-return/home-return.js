Component({ methods: { goHome() { wx.reLaunch({ url: '/pages/home/home', fail() { wx.showToast({ title: '返回首页失败，请重试', icon: 'none' }); } }); } } });
