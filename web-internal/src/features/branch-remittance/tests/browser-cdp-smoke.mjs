import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const server = await createServer({ define: { "import.meta.env.VITE_USE_MOCK": '"true"' }, server: { host: "127.0.0.1", port: 5227, strictPort: true } });
await server.listen();
const profile = await mkdtemp(join(tmpdir(), "kha46-cdp-"));
const browserPath = process.env.KHA46_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pngPath = join(profile, "receipt.png");
await writeFile(pngPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64"));
const browser = spawn(browserPath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-gpu-sandbox", "--disable-gpu-compositing", "--disable-software-rasterizer", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
const pending = new Map();
const runtimeErrors = [];
const results = [];
let socket;
let sessionId;
let requestId = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; }
    catch { await wait(100); }
  }
  assert.ok(port, "Chrome DevTools port did not start");
  const browserInfo = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(browserInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const callback = pending.get(message.id); pending.delete(message.id);
      if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
      else callback.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
    else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") runtimeErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  };
  const cdp = (method, params = {}, targetSession = sessionId) => new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, timeout = 12000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  const target = (await cdp("Target.getTargets", {}, null)).targetInfos.find((item) => item.type === "page");
  assert.ok(target, "Chrome page target did not start");
  sessionId = (await cdp("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null)).sessionId;
  await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("DOM.enable");

  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 980, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url: "http://127.0.0.1:5227/src/features/branch-remittance/tests/browser-harness.html" });
    await until('!!document.querySelector("tbody input[type=checkbox]")');
    await evaluate('document.querySelector("tbody input[aria-label=\\"Chọn CC-DNG-20261127-001\\"]").click()');

    for (const [selector, value] of [["#bank_name", "Ngân hàng Mock"], ["#bank_account_no", "001234500"], ["#bank_reference_no", "REF-2026-001"]]) {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      await cdp("Input.insertText", { text: value });
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).blur()`);
    }

    const { root } = await cdp("DOM.getDocument", { depth: -1, pierce: true });
    const fileNode = (await cdp("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type="file"]' })).nodeId;
    await cdp("DOM.setFileInputFiles", { files: [pngPath], nodeId: fileNode });
    await until('!!document.querySelector("[aria-label=\\"Ảnh sẵn sàng\\"]")');
    await until('!!document.querySelector("button[type=submit]") && !document.querySelector("button[type=submit]").disabled');

    const responsive = await evaluate(`(() => {
      const section = document.querySelector("#root > section");
      const scroller = document.querySelector(".overflow-x-auto");
      const controls = [...document.querySelectorAll("form input")].map((input) => input.getBoundingClientRect());
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth || section.scrollWidth > section.clientWidth,
        controlsFit: controls.every((rect) => rect.left >= 0 && rect.right <= innerWidth),
        tableOverflowX: getComputedStyle(scroller).overflowX,
        imagePreview: !!document.querySelector("img[alt=\\"Xem trước biên lai\\"]"),
        selectedCount: document.querySelectorAll("tbody input[type=checkbox]:checked").length,
        totalVisible: document.body.innerText.includes("4.250.000 VND"),
      };
    })()`);
    assert.equal(responsive.width, width);
    assert.equal(responsive.overflow, false);
    assert.equal(responsive.controlsFit, true);
    assert.equal(responsive.tableOverflowX, "auto");
    assert.equal(responsive.imagePreview, true);
    assert.equal(responsive.selectedCount, 1);
    assert.equal(responsive.totalVisible, true);

    await evaluate('document.querySelector("button[type=submit]").click()');
    await until('!!document.querySelector("[role=dialog]")');
    await evaluate('[...document.querySelectorAll("[role=dialog] button")].find((button) => button.textContent.includes("Xác nhận gửi")).click()');
    await until('document.body.innerText.includes("RM-DNG-20261128-001")');
    assert.equal(await evaluate('document.body.innerText.includes("chờ xác nhận")'), true);
    assert.equal(await evaluate('!!document.querySelector("tbody input[aria-label=\\"Chọn CC-DNG-20261127-001\\"]")'), false);
    results.push({ ...responsive, submitted: true });
    await cdp("Page.navigate", { url: "about:blank" });
  }
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ status: "PASS", browser: browserInfo.Browser, runtime_errors: runtimeErrors.length, checks: results }, null, 2));
} finally {
  socket?.close(); browser.kill(); server.httpServer?.closeAllConnections();
  await Promise.race([server.close(), wait(2000)]);
  await rm(profile, { recursive: true, force: true });
}
