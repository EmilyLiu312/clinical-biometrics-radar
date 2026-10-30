// Degradation test: empty data.json and fetch failure must never yield a blank page.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

function run(label, fetchImpl, expectIn) {
  return new Promise(function (resolve) {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) { w.fetch = fetchImpl; },
    });
    setTimeout(function () {
      const doc = dom.window.document;
      const empty = doc.getElementById('empty');
      const loading = doc.getElementById('loading');
      const visible = empty && !empty.hidden;
      const text = doc.body.textContent;
      const hit = expectIn.some(function (k) { return text.indexOf(k) >= 0; });
      const loadingGone = !loading || loading.style.display === 'none';
      const pass = visible && hit && loadingGone;
      console.log((pass ? '  ok  ' : 'FAIL ') + label +
        ' | emptyVisible=' + visible + ' | loadingHidden=' + loadingGone +
        ' | msg=' + (empty ? empty.textContent.slice(0, 50) : 'n/a'));
      if (!pass) process.exitCode = 1;
      resolve();
    }, 400);
  });
}

(async function () {
  await run('空数据', function () {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ updated: '', items: [] }); } });
  }, ['data.json', 'merge_items.py']);

  await run('data.json 404', function () {
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
  }, ['加载失败', 'http.server']);

  await run('网络异常', function () {
    return Promise.reject(new Error('offline'));
  }, ['加载失败', 'http.server']);

  console.log(process.exitCode ? 'DEGRADE_FAIL' : 'DEGRADE_OK');
})();
