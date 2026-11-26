import { createServer } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const server = await createServer({ server: { host: "127.0.0.1", port: 5198, strictPort: true }, clearScreen: false });
await server.listen();
const profile = await mkdtemp(join(tmpdir(), "kha38-chrome-"));
const artifacts = new URL("./artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
const chrome = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
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
  const response = await fetch("http://127.0.0.1:5198/src/features/warehouse-bags/tests/browser-harness.html", { signal: AbortSignal.timeout(5000) });
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
    if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result); }
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
  const fill = async (id, value) => evaluate(`(() => { const input = document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); })()`);
  const enter = async () => { await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); };
  const screenshot = async (name) => { const shot = await cdp("Page.captureScreenshot", { captureBeyondViewport: true }); await writeFile(new URL(name, artifacts), Buffer.from(shot.data, "base64")); };
  diagnostics.version = await cdp("Browser.getVersion");
  diagnostics.stages.push("Browser.getVersion responded");
  const target = await cdp("Target.createTarget", { url: "about:blank" });
  const attached = await cdp("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  sessionId = attached.sessionId;
  diagnostics.stages.push(`attached new target: ${target.targetId}`);
  await cdp("Runtime.enable");
  diagnostics.stages.push("Runtime.enable responded");
  await cdp("Page.enable");
  await cdp("Page.navigate", { url: "http://127.0.0.1:5198/src/features/warehouse-bags/tests/browser-harness.html" });
  await until(has("Dữ liệu Mock"));
  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await click("Đóng túi hàng");
    await fill("bag-seal", "000-SEAL-UI");
    await fill("bag-tracking", "UI-VS-0001"); await enter();
    await until(has("Đã tìm thấy vận đơn"));
    assert.equal(await evaluate("document.activeElement.id"), "bag-tracking");
    assert.equal(await evaluate("document.getElementById('bag-seal').value"), "000-SEAL-UI");
    assert.equal(await evaluate("[...document.querySelectorAll('button')].find(e => e.textContent.includes('Niêm phong túi')).disabled"), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `closing overflow ${width}`);
    await screenshot(`closing-${width}.png`);
    await click("Mở túi hàng");
    await fill("bag-lookup-value", "UI-BAG-002"); await enter();
    await until(has("UI-VS-0002"));
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `opening overflow ${width}`);
    assert.equal(await evaluate("[...document.querySelectorAll('button')].find(e => e.textContent.includes('Xác nhận mở túi')).disabled"), true);
    assert.equal(await evaluate("(() => { const table = document.querySelector('table'); return table.parentElement.scrollWidth >= table.parentElement.clientWidth && getComputedStyle(table.parentElement).overflowX === 'auto'; })()"), true);
    await screenshot(`opening-${width}.png`);
    checks.push(`375/768/1280 responsive: ${width}px, both tabs, no document overflow, scrollable table, Enter/focus, disabled mutations`);
  }
  await fill("bag-lookup-value", "MISSING"); await enter();
  await until(has("Không tìm thấy mã túi"));
  assert.equal(await evaluate(has("UI-VS-0002")), false);
  await click("Test Real"); await until(has("Chưa thể kết nối API thật"));
  assert.equal(await evaluate(has("Dữ liệu Mock")), false);
  await click("Test Empty"); await until(has("Danh sách túi mẫu đang rỗng"));
  await click("Test Mock"); await until(has("Dữ liệu Mock"));
  await fill("bag-lookup-value", "UI-BAG-001"); await enter(); await until(has("UI-VS-0001"));
  await click("Test Context"); await until(has("Chi nhánh hiện tại: 88"));
  assert.equal(await evaluate(has("UI-VS-0001")), false);
  checks.push("404 clears prior result; real BLOCKED has no Mock notice; empty; context clears result");
  await click("Test Route Block"); await until(has("Chưa xác nhận quyền truy cập trang"));
  assert.equal(await evaluate("document.querySelectorAll('[role=tab]').length"), 0);
  checks.push("production Page remains fail-closed; view uses isolated harness only");
  assert.deepEqual(errors, [], "console/runtime errors");
  const report = { checks, runtime_errors: errors.length, screenshots: 6, artifacts: artifacts.pathname, diagnostics };
  await writeFile(new URL("browser-report.json", artifacts), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error, errors);
  await writeFile(new URL("browser-failure.json", artifacts), JSON.stringify({ error: String(error), diagnostics, runtime_errors: errors }, null, 2));
  process.exitCode = 1;
} finally {
  socket?.close(); chrome.kill();
  server.httpServer?.closeAllConnections();
  await Promise.race([server.close(), wait(2000)]);
  process.exit(process.exitCode ?? 0);
}
