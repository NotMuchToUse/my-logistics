import { createServer } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const server = await createServer({ define: { "import.meta.env.VITE_USE_MOCK": '"true"' }, server: { host: "127.0.0.1", port: 5201, strictPort: true }, clearScreen: false });
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
  const response = await fetch("http://127.0.0.1:5201/login", { signal: AbortSignal.timeout(5000) });
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
  await cdp("Page.navigate", { url: "http://127.0.0.1:5201/login" });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const fill = async (selector, value) => evaluate(`(() => { const field = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const realClick = async (selector) => {
    const point = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  };
  const switchScope = async (label) => {
    await realClick("#active-branch");
    await until("!!document.querySelector('[role=option]')");
    const point = await evaluate(`(() => { const e = [...document.querySelectorAll('[role=option]')].find(e => e.textContent === ${JSON.stringify(label)}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
    await until("!document.querySelector('[role=option]')");
  };
  await until("!!document.querySelector('#identifier')");
  await fill("#identifier", "admin@vietstar.test");
  await fill("#password", "Vietstar123!");
  await realClick("button[type=submit]");
  await until("!!document.querySelector('#active-branch')");
  await until("document.querySelector('#active-branch').innerText.includes('Toàn hệ thống')");
  await realClick("a[href='/warehouse-history']");
  await until(has("96 phiếu"));
  assert.equal(await evaluate("new Set([...document.querySelectorAll('tbody tr')].map(row => row.cells[2].textContent)).size"), 3);
  checks.push("Main app Mock login as admin, Topbar hq_all, sidebar history, three branches on first page");
  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await wait(200);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot(`main-hq-${width}.png`);
  }
  const filterBranch = async (value) => evaluate(`(() => { const field = [...document.querySelectorAll('label')].find(e => e.firstChild.textContent === 'Chi nhánh').querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await filterBranch("3"); await until(has("48 phiếu"));
  assert.equal(await evaluate("[...document.querySelectorAll('tbody tr')].every(row => row.cells[2].textContent === 'Chi nhánh Đà Nẵng')"), true);
  await filterBranch("4"); await until(has("24 phiếu"));
  assert.equal(await evaluate("[...document.querySelectorAll('tbody tr')].every(row => row.cells[2].textContent === 'Bưu cục Sơn Trà')"), true);
  await filterBranch("1"); await until(has("Không có phiếu phù hợp"));
  await filterBranch(""); await until(has("96 phiếu"));
  await click("Sau"); await until(has("Trang 2/5"));
  await fill("input[placeholder='Tìm mã phiếu mẫu']", "0001"); await until(has("1 phiếu"));
  await click("Xóa bộ lọc"); await until(has("96 phiếu"));
  await switchScope("Chi nhánh Đà Nẵng"); await until(has("48 phiếu"));
  await switchScope("Bưu cục Sơn Trà"); await until(has("24 phiếu"));
  await switchScope("Toàn hệ thống"); await until(has("96 phiếu"));
  checks.push("Branch filters, empty branch without warehouse, pagination/search/reset and real BranchSwitcher transitions");
  await fill("input[placeholder='Tìm mã phiếu mẫu']", "0001"); await until(has("1 phiếu"));
  await realClick("tbody a"); await until(has("Xem trước bảng kê"));
  assert.equal(await evaluate("!![...document.querySelectorAll('button')].find(e => e.textContent === 'Mở khóa phiếu')"), false);
  await cdp("Page.reload"); await wait(300); await until(has("Xem trước bảng kê"));
  await click("Xem trước bảng kê"); await until(has("BẢNG KÊ GIAO HÀNG"));
  await wait(250); await screenshot("main-hq-preview.png");
  checks.push("Main app direct detail refresh, delivery preview, no unlock permission granted to admin");
  await cdp("Page.navigate", { url: "http://127.0.0.1:5201/warehouse-history/01K00000000000000000000010" });
  await wait(300); await until(has("Xem trước bảng kê")); await click("Xem trước bảng kê"); await until(has("BẢNG KÊ XUẤT KHO"));
  await evaluate("document.querySelector('[role=dialog] button span.sr-only').parentElement.click()");
  await realClick("button[aria-label='Đăng xuất']"); await until("!!document.querySelector('#identifier')");
  await fill("#identifier", "reception@vietstar.test"); await fill("#password", "Vietstar123!"); await realClick("button[type=submit]");
  await until("!!document.querySelector('#active-branch')");
  await realClick("a[href='/warehouse-history']"); await until(has("Bạn chưa có phiên đăng nhập, quyền xem kho"));
  assert.equal(await evaluate("!!document.querySelector('tbody')"), false);
  checks.push("Real Mock receptionist login without warehouse.read cannot see receipt data");
  assert.deepEqual(errors, []);
  await writeFile(new URL("main-app-result.json", artifacts), JSON.stringify({ checks, runtime_errors: errors.length, browser: diagnostics.version.product }, null, 2));
  console.log(JSON.stringify({ checks, runtime_errors: errors.length }, null, 2));
} catch (error) {
  console.error(error); process.exitCode = 1;
  await writeFile(new URL("main-app-failure.json", artifacts), JSON.stringify({ error: String(error), diagnostics, errors }, null, 2));
} finally {
  socket?.close(); chrome.kill(); server.httpServer?.closeAllConnections();
  await Promise.race([server.close(), wait(2000)]);
  process.exit(process.exitCode ?? 0);
}
