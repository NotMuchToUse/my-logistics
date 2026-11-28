import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.KHA46_APP_URL || "http://127.0.0.1:5173";
const browserPath = process.env.KHA46_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const artifacts = new URL("./artifacts/", import.meta.url);
const profile = await mkdtemp(join(tmpdir(), "kha46-app-cdp-"));
const receiptPath = join(profile, "mock-receipt.png");
await writeFile(receiptPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64"));
await mkdir(artifacts, { recursive: true });
const browser = spawn(browserPath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-gpu-sandbox", "--disable-gpu-compositing", "--disable-software-rasterizer", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
const pending = new Map();
const runtimeErrors = [];
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
      if (message.error) callback.reject(new Error(`${callback.method}: ${JSON.stringify(message.error)}`));
      else callback.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
    else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") runtimeErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  };
  const cdp = (method, params = {}, targetSession = sessionId) => new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { method, resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
  const evaluate = async (expression) => {
    let result;
    try { result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); }
    catch (error) { throw new Error(`Runtime expression failed: ${expression}: ${error instanceof Error ? error.message : String(error)}`); }
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await wait(75);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  const click = (selector) => evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error("Missing " + ${JSON.stringify(selector)}); element.click(); return true; })()`);
  const fill = async (selector, value) => {
    await click(selector);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).select()`);
    await cdp("Input.insertText", { text: value });
  };
  const selectValue = async (selector, value) => evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
  const screenshot = async (name) => {
    const image = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
    await writeFile(new URL(name, artifacts), Buffer.from(image.data, "base64"));
  };

  const target = (await cdp("Target.getTargets", {}, null)).targetInfos.find((item) => item.type === "page");
  assert.ok(target, "Chrome page target did not start");
  sessionId = (await cdp("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null)).sessionId;
  await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("DOM.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/login` });
  await until('!!document.querySelector("#identifier") && !!document.querySelector("#password")');
  await fill("#identifier", "admin@vietstar.test");
  await fill("#password", "Vietstar123!");
  await click('form button[type="submit"]');
  await until('location.pathname !== "/login" && !!document.querySelector("a[href=\\"/branch-remittance\\"]")');
  assert.equal(await evaluate('document.body.innerText.includes("Nộp tiền về trung tâm")'), true, "Admin Mock should see the finance Sidebar item");
  await click('a[href="/branch-remittance"]');
  await until('location.pathname === "/branch-remittance" && document.body.innerText.includes("CC-DNG-20261127-001") && document.body.innerText.includes("CC-DNG-20261127-006")');
  await until('document.body.innerText.includes("Mock Mode")');
  await cdp("Page.reload", { ignoreCache: true });
  await until('location.pathname === "/branch-remittance" && document.body.innerText.includes("CC-DNG-20261127-001") && document.body.innerText.includes("CC-DNG-20261127-006")');
  await cdp("Page.navigate", { url: `${baseUrl}/shipment-list` });
  await until('location.pathname === "/shipment-list" && document.body.innerText.includes("Danh sách vận đơn")');
  await cdp("Page.navigate", { url: `${baseUrl}/branch-remittance` });
  await until('location.pathname === "/branch-remittance" && document.body.innerText.includes("CC-DNG-20261127-001") && document.body.innerText.includes("CC-DNG-20261127-006")');
  assert.equal(await evaluate('document.querySelector("#active-branch")?.innerText.includes("Toàn hệ thống")'), true, "Admin must remain in hq_all");
  assert.equal(await evaluate('document.body.innerText.includes("Mock Mode")'), true, await evaluate('document.body.innerText'));
  assert.equal(await evaluate('document.body.innerText.includes("Trung tâm Đà Nẵng")'), true, await evaluate('document.body.innerText'));
  assert.equal(await evaluate('document.body.innerText.includes("Bưu cục Sơn Trà") && document.body.innerText.includes("Chi nhánh Đà Nẵng")'), true, "All fixture units should be shown with source names");
  assert.equal(await evaluate('document.querySelector("input[aria-label=\\"Chọn tất cả bảng kê đang hiển thị\\"]")?.disabled'), true, "Select-all across multiple units must be disabled");

  for (const width of [375, 768, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 980, deviceScaleFactor: 1, mobile: false });
    const responsive = await evaluate(`(() => { const section = document.querySelector("main section"); const scroller = document.querySelector(".overflow-x-auto"); const controls = [...document.querySelectorAll("form input")].map((input) => input.getBoundingClientRect()); return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth || section.scrollWidth > section.clientWidth, controlsFit: controls.every((rect) => rect.left >= 0 && rect.right <= innerWidth), tableOverflowX: getComputedStyle(scroller).overflowX }; })()`);
    assert.equal(responsive.width, width);
    assert.equal(responsive.overflow, false, `Horizontal overflow at ${width}px`);
    assert.equal(responsive.controlsFit, true, `Form control overflow at ${width}px`);
    assert.equal(responsive.tableOverflowX, "auto");
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 980, deviceScaleFactor: 1, mobile: false });

  await fill('input[aria-label="Tìm mã bảng kê"]', "no-such-collection");
  await until('document.body.innerText.includes("Không tìm thấy bảng kê phù hợp.")');
  await fill('input[aria-label="Tìm mã bảng kê"]', "CC-DNG-20261127-00");
  await until('document.body.innerText.includes("CC-DNG-20261127-001") && document.body.innerText.includes("CC-DNG-20261127-006")');
  await selectValue('select[aria-label="Lọc chi nhánh/bưu cục"]', "3");
  await until('document.body.innerText.includes("CC-DNG-20261127-006") && !document.body.innerText.includes("CC-DNG-20261127-001")');
  await selectValue('select[aria-label="Lọc chi nhánh/bưu cục"]', "all");
  await until('document.body.innerText.includes("CC-DNG-20261127-001")');
  await click('tbody input[aria-label="Chọn CC-DNG-20261127-001"]');
  assert.equal(await evaluate('document.body.innerText.includes("4.250.000 VND")'), true);
  assert.equal(await evaluate('document.querySelector("tbody input[aria-label=\\"Chọn CC-DNG-20261127-006\\"]")?.disabled'), true, "A collection from another unit must not be selectable into this remittance");
  for (const [selector, value] of [["#bank_name", "Ngân hàng Mock"], ["#bank_account_no", "001234500"], ["#bank_reference_no", "REF-APP-001"]]) await fill(selector, value);
  await evaluate('(() => { document.activeElement?.blur(); return true; })()');
  const { root } = await cdp("DOM.getDocument", { depth: 0, pierce: true });
  const fileNode = (await cdp("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type="file"]' })).nodeId;
  await cdp("DOM.setFileInputFiles", { files: [receiptPath], nodeId: fileNode });
  await until('!!document.querySelector("[aria-label=\\"Ảnh sẵn sàng\\"]")');
  await screenshot("kha46-admin-before-submit.png");
  await click('button[type="submit"]');
  await wait(500);
  if (!(await evaluate('!!document.querySelector("[role=dialog]")'))) {
    throw new Error(`Submit did not open confirmation. ${await evaluate('document.body.innerText')}`);
  }
  await until('!!document.querySelector("[role=dialog]")');
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].find((button) => button.textContent.includes("Quay lại")).click()');
  assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false, "Cancel should close confirmation");
  assert.equal(await evaluate('document.querySelector("#bank_account_no")?.value'), "001234500", "Cancel should preserve transfer fields");
  assert.equal(await evaluate('document.querySelector("tbody input[aria-label=\\"Chọn CC-DNG-20261127-001\\"]")?.checked'), true, "Cancel should preserve selection");
  await click('button[type="submit"]');
  await until('!!document.querySelector("[role=dialog]")');
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].find((button) => button.textContent.includes("Xác nhận gửi")).click()');
  await until('document.body.innerText.includes("RM-DNG-20261128-001")');
  await until('document.body.innerText.includes("Mock đã ghi nhận phiếu") && !document.querySelector("[aria-label=\\"Đang tải bảng kê\\"]")');
  assert.equal(await evaluate('document.body.innerText.includes("submitted")'), true);
  assert.equal(await evaluate('!!document.querySelector("tbody input[aria-label=\\"Chọn CC-DNG-20261127-001\\"]")'), false, "Submitted collection must no longer be selectable");
  assert.equal(await evaluate('document.querySelector("#active-branch")?.innerText.includes("Toàn hệ thống")'), true, "Submission must not change Topbar scope");
  await screenshot("kha46-admin-submitted.png");

  await evaluate('localStorage.clear(); sessionStorage.clear(); location.href="/login"');
  await until('location.pathname === "/login"');
  await until('!!document.querySelector("#identifier")');
  await fill("#identifier", "reception@vietstar.test");
  await fill("#password", "Vietstar123!");
  await click('form button[type="submit"]');
  await until('location.pathname !== "/login" && !!document.querySelector("a[href=\\"/shipment-list\\"]")');
  assert.equal(await evaluate('!!document.querySelector("a[href=\\"/branch-remittance\\"]")'), false, "Account without finance.read must not see the Sidebar item");
  await cdp("Page.navigate", { url: `${baseUrl}/branch-remittance` });
  await until('document.body.innerText.includes("Bạn chưa có quyền xem nghiệp vụ nộp tiền")');
  assert.equal(await evaluate('!!document.querySelector("tbody input[type=checkbox]")'), false, "Direct URL must remain page-guarded");
  await evaluate('localStorage.clear(); sessionStorage.clear(); location.href="/branch-remittance"');
  await until('location.pathname === "/login" && !!document.querySelector("#identifier")');
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ status: "PASS", browser: browserInfo.Browser, admin: "admin@vietstar.test / existing Mock password", branch_scope: "Toàn hệ thống (hq_all)", direct_route_refresh: "PASS", navigate_away_and_back: "PASS", fixture_units: 2, unit_filter: "PASS", search_empty_state: "PASS", confirmation_cancel_preserves_data: "PASS", cross_unit_selection_blocked: true, responsive_widths: [375, 768, 1280], menu: "Nộp tiền về trung tâm", mock_submission: "submitted", unauthorized_sidebar: "hidden", unauthorized_direct_url: "guarded", invalid_session_redirect: "PASS", runtime_errors: runtimeErrors.length, screenshots: ["kha46-admin-before-submit.png", "kha46-admin-submitted.png"] }, null, 2));
} finally {
  socket?.close();
  const browserExited = new Promise((resolve) => browser.once("exit", resolve));
  browser.kill();
  await Promise.race([browserExited, wait(5000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
