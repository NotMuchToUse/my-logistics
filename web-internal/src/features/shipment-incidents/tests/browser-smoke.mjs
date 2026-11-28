import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// No dependency installation or shared-auth changes. Uses installed Chrome and native CDP.
const server = await createServer({ server: { host: '127.0.0.1', port: 5189, strictPort: true }, clearScreen: false });
await server.listen();
console.log('Vite ready');
const profile = await mkdtemp(join(tmpdir(), 'kha34-chrome-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-software-rasterizer', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', data => console.log(String(data).trim()));
chrome.on('exit', code => console.log('Chrome exited', code));
let socket;
const errors = [];
const checks = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await wait(100); } }
  if (!port) throw new Error('Chrome debugging port unavailable');
  console.log('Chrome port ready');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('CDP socket open timeout')), 5000); socket.onopen = () => { clearTimeout(timer); resolve(); }; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result); } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.value ?? a.description).join(' ')); };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async (expression, label) => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(75); } throw new Error(`Timed out: ${label}\n${await evaluate('document.body.innerText')}`); };
  const click = async text => { await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) throw Error('Button unavailable: ' + ${JSON.stringify(text)}); b.click(); })()`); await wait(80); };
  const fill = async (id, value) => { await evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : e.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`); await wait(80); };
  const bodyHas = text => `document.body.innerText.includes(${JSON.stringify(text)})`;
  await cdp('Runtime.enable'); await cdp('Page.enable');
  console.log('Browser connected; loading isolated harness');
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5189/src/features/shipment-incidents/tests/browser-harness.html' });
  await until('document.querySelectorAll("tbody tr").length === 20', 'authorized list');
  checks.push('Authorized Mock list / StrictMode: 20 of 24 rows');
  for (const width of [375, 768, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }); await wait(100);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `overflow at ${width}`);
    await click('Tạo báo cáo sự cố');
    await wait(300);
    assert.equal(await evaluate('(() => { const r = document.querySelector("[role=dialog]").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height <= innerHeight; })()'), true, `dialog at ${width}`);
    await click('Hủy');
    checks.push(`Content and create dialog fit ${width}px`);
  }
  await click('Sau'); await until('document.querySelectorAll("tbody tr").length === 4', 'second page'); await click('Trước');
  await fill('incident-search', 'NO-MATCH'); await until(bodyHas('Không có hồ sơ sự cố'), 'empty search'); await click('Xóa bộ lọc');
  await fill('type-filter', 'lost'); await until('document.querySelectorAll("tbody tr").length === 4', 'type filter'); await click('Xóa bộ lọc');
  checks.push('Pagination, debounced empty search, type filter and reset');
  await click('Test 422'); await click('Tạo báo cáo sự cố'); await fill('shipment-id', '10'); await fill('incident-description', 'Báo cáo từ browser'); await click('Lưu báo cáo');
  await until(bodyHas('Mô tả cần xác minh (Mock)'), '422 field error'); assert.equal(await evaluate('document.getElementById("incident-description").value'), 'Báo cáo từ browser');
  await click('Hủy'); checks.push('422 maps into form and preserves description');
  await click('Test network create'); await click('Tạo báo cáo sự cố'); await fill('shipment-id', '10'); await fill('incident-description', '<script>alert(1)</script> Chứng từ browser');
  await evaluate(`(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 10; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#64748b'; ctx.fillRect(0, 0, 10, 10); return new Promise(resolve => canvas.toBlob(blob => { const dt = new DataTransfer(); dt.items.add(new File([blob], 'evidence.png', { type: 'image/png' })); dt.items.add(new File(['bad'], 'bad.php.png', { type: 'image/png' })); const input = document.getElementById('incident-evidence'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); resolve(); }, 'image/png')); })()`);
  await until('document.querySelector("[role=dialog] img")?.complete', 'image preview'); await until(bodyHas('Tên file hoặc phần mở rộng không an toàn'), 'file rejection');
  await click('Lưu báo cáo'); await until(bodyHas('Thử lại lượt gửi'), 'network retry');
  await click('Hủy'); await until('!document.querySelector("[role=dialog]")', 'close ambiguous create');
  await click('Tạo báo cáo sự cố'); await until(bodyHas('Thử lại lượt gửi'), 'pending create survives dialog remount');
  await click('Thử lại lượt gửi'); await until('!document.querySelector("[role=dialog]")', 'replay success'); await until(bodyHas('25 hồ sơ'), 'deduplicated count');
  await evaluate('document.querySelector("tbody tr button").click()'); await until(bodyHas('Chi tiết sự cố'), 'detail'); await until('document.querySelector("[role=dialog] img")?.complete', 'saved evidence preview');
  assert.equal(await evaluate('document.querySelector("[role=dialog]").innerText.includes("<script>alert(1)</script>")'), true);
  checks.push('PNG preview, malicious file rejection, timeout/replay single create, saved image and escaped description');
  await click('Gán trách nhiệm'); await fill('responsible-user', '22'); await fill('resolution-note', 'Xác minh bàn giao'); await click('Lưu thay đổi'); await until(bodyHas('Chi tiết sự cố'), 'assignment saved'); await until(bodyHas('Xác minh bàn giao'), 'assignment detail');
  await click('Đóng'); await click('Test conflict'); await evaluate('document.querySelector("tbody tr button").click()'); await until(bodyHas('Chi tiết sự cố'), 'reopen detail'); await click('Gán trách nhiệm'); await fill('resolution-note', 'Stale note'); await click('Lưu thay đổi'); await until(bodyHas('Tải lại hồ sơ'), 'conflict'); await click('Tải lại hồ sơ'); await until(bodyHas('Đã cập nhật bởi phiên khác'), 'fresh conflict record');
  checks.push('Assignment persists; 409 reload retrieves new record without overwrite');
  await click('Chuyển đề xuất đền bù'); await click('Xác nhận chuyển (Mock)'); await until(bodyHas('Chi tiết sự cố'), 'handoff detail'); await until('document.querySelector("[role=dialog]").innerText.includes("Đã đề xuất đền bù")', 'handoff status'); await click('Đóng'); checks.push('Confirmed Mock handoff transitions to compensation_requested');
  await click('Test list error'); await click('Làm mới'); await until(bodyHas('Thử lại'), 'list network error'); await click('Thử lại'); await until('document.querySelectorAll("tbody tr").length === 20', 'list retry');
  await click('Test stale response'); await fill('incident-search', 'INC'); await click('Test đổi chi nhánh'); await until(bodyHas('4 hồ sơ'), 'branch 4'); await wait(900);
  assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), 4); assert.equal(await evaluate('document.querySelector("tbody").innerText.includes("INC-MOCK")'), false);
  checks.push('List failure/retry and delayed old-branch response isolation');
  await click('Test quyền'); await until(bodyHas('Bạn không có quyền'), 'permission denied'); assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'), 0); checks.push('Denied session has no rows');
  assert.deepEqual(errors, [], 'browser console/runtime errors');
  console.log(JSON.stringify({ checks, runtimeErrors: errors.length, profile }, null, 2));
  if (process.env.KHA34_SCREENSHOT) { const shot = await cdp('Page.captureScreenshot'); await writeFile(process.env.KHA34_SCREENSHOT, Buffer.from(shot.data, 'base64')); }
} catch (error) {
  console.error('BROWSER FAILURE', error, 'runtime errors:', JSON.stringify(errors));
  process.exitCode = 1;
} finally {
  socket?.close(); chrome.kill();
  server.httpServer?.closeAllConnections();
  await Promise.race([server.close(), wait(2000)]);
  process.exit(process.exitCode ?? 0);
}
