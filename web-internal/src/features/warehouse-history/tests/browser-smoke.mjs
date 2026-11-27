import { createServer } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const server = await createServer({ plugins: [{ name: "kha42-harness-fallback", configureServer(instance) { instance.middlewares.use((request, _response, next) => { if (/^\/(warehouse-history|qa\/manifest)(\/|$)/.test(request.url || "")) request.url = "/src/features/warehouse-history/tests/browser-harness.html"; next(); }); } }], define: { "import.meta.env.VITE_USE_MOCK": '"true"' }, server: { host: "127.0.0.1", port: 5199, strictPort: true }, clearScreen: false });
await server.listen();
const profile = await mkdtemp(join(tmpdir(), "kha42-chrome-"));
const artifacts = new URL("./artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const chrome = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", ...JSON.parse(process.env.KHA42_BROWSER_FLAGS || "[]"), "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
const diagnostics = { profile, browser_pid: chrome.pid, browser_stderr: [], stages: [] };
chrome.stderr.on("data", (data) => diagnostics.browser_stderr.push(String(data).slice(0, 4000)));
chrome.on("error", (error) => diagnostics.stages.push(`launch error: ${error.message}`));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
const errors = [];
const checks = [];
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch { await wait(100); }
  }
  if (!port) throw new Error("Chrome debugging port unavailable");
  diagnostics.stages.push(`debugging port ready: ${port}`);
  const response = await fetch("http://127.0.0.1:5199/src/features/warehouse-history/tests/browser-harness.html", { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  diagnostics.stages.push("dev server harness HTTP 200");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5000) })).json();
  diagnostics.stages.push(`browser endpoint ready: ${version.Browser}`);
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP WebSocket open timeout")), 5000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = (error) => { clearTimeout(timer); reject(error); };
  });
  let sequence = 0;
  let sessionId;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); if (message.error) callback.reject(new Error(JSON.stringify(message.error))); else callback.resolve(message.result); }
    else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error(`CDP timeout ${method}`)), 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(75); }
    throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText")}`);
  };
  const has = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
  const click = async (text) => { await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) throw Error('Button unavailable'); button.click(); })()`); await wait(50); };
  const screenshot = async (name) => { const shot = await cdp("Page.captureScreenshot", { captureBeyondViewport: true }); await writeFile(new URL(name, artifacts), Buffer.from(shot.data, "base64")); };
  diagnostics.version = await cdp("Browser.getVersion");
  diagnostics.stages.push("Browser.getVersion responded");
  const target = (await cdp("Target.getTargets")).targetInfos.find((info) => info.type === "page");
  const attached = await cdp("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  sessionId = attached.sessionId;
  diagnostics.stages.push(`attached new target: ${target.targetId}`);
  await cdp("Runtime.enable");
  diagnostics.stages.push("Runtime.enable responded");
  await cdp("Page.enable");
  await cdp("Page.navigate", { url: "http://127.0.0.1:5199/src/features/warehouse-history/tests/browser-harness.html" });
  await until(has("48 phiếu"));
  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`list-${width}.png`);
  }
  checks.push("Responsive list at 375/768/1280");
  const change = async (label, value) => evaluate(`(() => { const label = [...document.querySelectorAll('label')].find(e => e.firstChild.textContent === ${JSON.stringify(label)}); const field = label.querySelector('input,select'); const proto = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
  await change("Mã phiếu", "0048"); await until(has("1 phiếu · Trang 1/1"));
  await click("Xóa bộ lọc"); await until(has("48 phiếu"));
  await change("Loại phiếu", "inbound"); await until(has("16 phiếu"));
  await change("Trạng thái", "confirmed"); await until(has("3 phiếu"));
  await change("Từ ngày", "2026-11-29"); await until(has("Không có phiếu phù hợp"));
  await click("Xóa bộ lọc"); await until(has("48 phiếu"));
  await click("Test đổi chi nhánh"); await until(has("24 phiếu"));
  assert.equal(await evaluate("document.querySelector('tbody').innerText.includes('DEMO-KHO-0049')"), true);
  await click("Test quyền"); await until(has("Bạn chưa có phiên"));
  assert.equal(await evaluate("!!document.querySelector('tbody')"), false);
  await click("Test quyền"); await click("Test đổi chi nhánh"); await until(has("48 phiếu"));
  checks.push("Search, type/status/date filters, empty/reset, branch isolation and denied context");
  await click("Sau"); await until(has("Trang 2/3"));
  await click("Trước"); await until(has("Trang 1/3"));
  await evaluate("document.querySelector('tbody a').click()");
  await until(has("Mở khóa phiếu"));
  await cdp("Page.reload"); await wait(250); await until("!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Mở khóa phiếu')");
  checks.push("Direct detail refresh through isolated harness fallback");
  await click("Xem trước bảng kê"); await until(has("BẢNG KÊ GIAO HÀNG"));
  assert.equal(await evaluate("document.querySelector('[role=dialog]').innerText.includes('DEMO-REMOVED')"), false);
  await cdp("Emulation.setEmulatedMedia", { media: "print" });
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.warehouse-history-print')).display"), "block");
  await cdp("Emulation.setEmulatedMedia", { media: "screen" });
  await evaluate("document.querySelector('[role=dialog] button span.sr-only').parentElement.click()");
  await until("!document.querySelector('[role=dialog]')");
  checks.push("Detail URL, delivery manifest and print media isolation");
  await click("Mở khóa phiếu"); await click("Xác nhận mở khóa");
  await until(has("Vui lòng nhập lý do"));
  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await wait(250); await screenshot(`unlock-${width}.png`); const bounds = await evaluate("(() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}; })()"); assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, JSON.stringify(bounds));
    await screenshot(`unlock-${width}.png`);
  }
  await evaluate(`(() => { const field = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'Điều chỉnh browser Mock'); field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click("Xác nhận mở khóa"); await until(has("Đã mở khóa"));
  assert.equal(await evaluate("!!document.querySelector('[role=dialog]')"), false);
  checks.push("Unlock validation and Mock success");
  await cdp("Page.navigate", { url: "http://127.0.0.1:5199/warehouse-history/01K00000000000000000000010" });
  await until(has("Xem trước bảng kê")); await click("Xem trước bảng kê"); await until(has("BẢNG KÊ XUẤT KHO"));
  checks.push("Outbound manifest template");
  await cdp("Page.navigate", { url: "http://127.0.0.1:5199/qa/manifest" });
  await until(has("DEMO-LONG-180-"));
  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await wait(250); await screenshot(`manifest-long-${width}.png`); const bounds = await evaluate("(() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}; })()"); assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, JSON.stringify(bounds));
  }
  await cdp("Emulation.setEmulatedMedia", { media: "print" });
  assert.equal(await evaluate("document.querySelector('.warehouse-history-print tbody').rows.length"), 180);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#root')).display"), "none");
  assert.equal(await evaluate("document.querySelector('.warehouse-history-print table').getBoundingClientRect().width <= innerWidth"), true);
  const pdf = await cdp("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  const bytes = Buffer.from(pdf.data, "base64");
  const pages = [...bytes.toString("latin1").matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.ok(pages > 1, `Expected multi-page PDF, got ${pages}`);
  await writeFile(new URL("manifest-long.pdf", artifacts), bytes);
  checks.push(`A4 PDF with 180 rows across ${pages} pages; no controls in print root`);
  await cdp("Emulation.setEmulatedMedia", { media: "screen" });
  await writeFile(new URL("browser-result.json", artifacts), JSON.stringify({ checks, runtime_errors: errors.length, browser: diagnostics.version.product }, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, runtime_errors: errors.length }, null, 2));
} catch (error) {
  console.error(error); process.exitCode = 1;
  await writeFile(new URL(`failure-${process.env.KHA42_ATTEMPT || "default"}.json`, artifacts), JSON.stringify({ error: String(error), diagnostics, errors }, null, 2));
} finally {
  socket?.close(); chrome.kill(); server.httpServer?.closeAllConnections();
  await Promise.race([server.close(), wait(2000)]);
  process.exit(process.exitCode ?? 0);
}
