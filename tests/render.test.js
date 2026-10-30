// Headless render smoke test for the static page.
// Loads index.html in jsdom, stubs fetch() to serve ./data.json, then asserts
// that the real DOM contains the expected cards, chips, deadline dates and links.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(win) {
    win.fetch = function () {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve(data); },
      });
    };
  },
});

const win = dom.window;
const doc = win.document;

function fail(msg) { console.log('FAIL ' + msg); process.exitCode = 1; }
function ok(msg) { console.log('  ok  ' + msg); }

setTimeout(function () {
  const loading = doc.getElementById('loading');
  if (loading && loading.style.display !== 'none') fail('loading 未隐藏');
  else ok('loading 已隐藏');

  const cards = doc.querySelectorAll('#list .card');
  const expected = data.items.length;
  if (cards.length !== expected) fail('卡片数 ' + cards.length + ' != ' + expected);
  else ok('卡片数 ' + cards.length);

  // template must stay hidden and outside the list
  const tpl = doc.querySelectorAll('#cardTpl .card');
  if (tpl.length !== 1) fail('模板卡片数异常 ' + tpl.length);
  else ok('模板卡片未被渲染进列表');

  // original links
  const links = doc.querySelectorAll('#list .card a.n-link');
  let real = 0, hiddenLinks = 0;
  links.forEach(function (a) {
    if (/^https?:\/\//.test(a.getAttribute('href') || '')) real++;
    if (a.style.display === 'none') hiddenLinks++;
  });
  if (real !== expected) fail('原文链接 ' + real + ' != ' + expected);
  else ok('原文链接 ' + real + ' 条全部指向 http(s)');
  if (hiddenLinks) fail(hiddenLinks + ' 条链接被隐藏'); else ok('无隐藏链接');

  // deadline sidebar must show month+day, never NaN
  const dl = doc.querySelectorAll('#deadlines .dl-date');
  const dates = [];
  dl.forEach(function (n) { dates.push(n.textContent.trim()); });
  const bad = dates.filter(function (s) { return !/^\d{1,2}月\d{1,2}日$|^\d{4}年\d{1,2}月\d{1,2}日$/.test(s); });
  if (bad.length) fail('截止日格式异常: ' + bad.join(' | '));
  else ok('截止日 ' + dates.length + ' 条: ' + dates.join(', '));

  // NaN scan must ignore <script>/<style> bodies
  const walk = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_TEXT);
  let n, nanHits = [];
  while ((n = walk.nextNode())) {
    const tag = n.parentNode && n.parentNode.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
    if (n.nodeValue.indexOf('NaN') >= 0) nanHits.push(n.nodeValue.slice(0, 60));
  }
  if (nanHits.length) fail('可见文本出现 NaN: ' + nanHits.join(' | '));
  else ok('可见文本无 NaN');

  const chips = doc.querySelectorAll('#chips .chip');
  ok('分类 chips ' + chips.length + ' 个: ' +
    Array.from(chips).map(function (c) { return c.textContent.replace(/\s+/g, ''); }).join(' '));

  const kpi = ['kpiTotal', 'kpiToday', 'kpiHigh', 'kpiDue'].map(function (id) {
    const e = doc.getElementById(id);
    return id.replace('kpi', '') + '=' + (e ? e.textContent : 'missing');
  });
  ok('KPI ' + kpi.join(' '));

  const empty = doc.getElementById('empty');
  if (empty && !empty.hidden) fail('空状态不该显示'); else ok('空状态已隐藏');

  const note = doc.getElementById('snapNote');
  ok('数据说明条: ' + (note ? (note.style.display + ' / ' + note.textContent.slice(0, 40)) : 'missing'));

  // category filter interaction: click first non-"全部" chip, expect subset
  const target = chips[1];
  if (target) {
    target.onclick();
    const after = doc.querySelectorAll('#list .card').length;
    if (after <= 0 || after >= expected) fail('分类筛选无效果 ' + after);
    else ok('分类筛选生效: ' + target.textContent.replace(/\s+/g, '') + ' -> ' + after + ' 条');
  }

  console.log(process.exitCode ? 'RENDER_FAIL' : 'RENDER_OK');
}, 400);
