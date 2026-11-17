const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const catalog = require('../miniprogram/utils/tool-catalog');
const root = path.resolve(__dirname, '../miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));

function loadPage(route) {
  const file = path.join(root, route.replace(/^\//, '') + '.js');
  let page;
  const navigations = [];
  const wx = {
    getStorageSync: () => '', showToast() {}, showShareMenu() {},
    navigateTo: request => navigations.push(request),
    setStorageSync: () => { throw new Error('Navigation must not write business records'); }
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    Page: value => { page = value; }, wx, console,
    require: relative => require(path.resolve(path.dirname(file), relative))
  });
  page.data = structuredClone(page.data);
  page.setData = (values, callback) => {
    for (const [key, value] of Object.entries(values)) {
      const pieces = key.split('.'); let cursor = page.data;
      for (const piece of pieces.slice(0, -1)) cursor = cursor[piece];
      cursor[pieces.at(-1)] = value;
    }
    if (callback) callback();
  };
  return { page, navigations };
}

for (const entry of [...catalog.tools, ...catalog.quick]) {
  test(`3.0 entry ${entry.key}: registered route, correct tool/view, data-free share, home return`, () => {
    const home = loadPage('/pages/home/home');
    home.page.openTool({ currentTarget: { dataset: { key: entry.key } } });
    assert.equal(home.navigations.length, 1);
    const target = home.navigations[0].url;
    const [route, query = ''] = target.split('?');
    assert(app.pages.includes(route.slice(1)));
    const options = Object.fromEntries(new URLSearchParams(query));
    const { page } = loadPage(route);
    if (route === '/pages/index/index') {
      page.onLoad(options); // Real restore/recalculate/report lifecycle, empty synthetic storage.
      assert.equal(page.data.activeTool, options.tool);
      assert.equal(page.data.workbenchView, entry.view || 'overview');
      const flags = Object.entries(page.data).filter(([key]) => /^is(?:Operations|Margin|Deal|Loss|Yield|Health|Revenue|Site|Recruitment|Xhs|Dianping|TaskReminder|Incentive|Schedule|Share)$/.test(key));
      assert.equal(flags.filter(([, value]) => value).length, 1);
      assert.equal(page.onShareAppMessage().path, `/pages/index/index?tool=${options.tool}`);
      assert.equal(page.onShareTimeline().query, `tool=${options.tool}`);
    } else {
      assert.equal(page.onShareAppMessage().path, route);
    }
    const config = JSON.parse(fs.readFileSync(path.join(root, route + '.json')));
    assert.equal(config.usingComponents['home-return'], '/components/home-return/home-return');
    assert.match(fs.readFileSync(path.join(root, route + '.wxml'), 'utf8'), /^<home-return\s*\/>/);
    let component, destination;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'components/home-return/home-return.js'), 'utf8'), {
      Component: value => { component = value; },
      wx: { reLaunch: request => { destination = request.url; } }
    });
    component.methods.goHome();
    assert.equal(destination, '/pages/home/home');
  });
}

test('3.0 unknown deep link does not select or inject an unknown tool/view', () => {
  const { page, navigations } = loadPage('/pages/index/index');
  page.onLoad({ tool: 'not-a-tool', view: 'not-a-view' });
  assert.equal(page.data.activeTool, 'operations');
  assert.equal(page.data.workbenchView, 'overview');
  assert.equal(navigations.length, 0);
});
