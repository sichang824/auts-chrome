// ==UserScript==
// @name         AUTS Plugin Info Example
// @namespace    https://auts.local/examples
// @version      0.1.0
// @description  Minimal example for reading AUTS plugin info in main script and @require modules.
// @author       AUTS
// @match        *://*/*
// @run-at       document-end
// @grant        GM_info
// @require      https://example.com/module-a.js
// @require      https://example.com/module-b.js
// ==/UserScript==

(function() {
  "use strict";

  // auts() 当前可用属性：
  // - id: AUTS 内部脚本 ID
  // - name: 脚本名，对应 @name
  // - namespace: 命名空间，对应 @namespace
  // - version: 脚本版本，对应 @version
  // - buildVersion: 当前等同于 version，预留给构建版本
  // - description: 脚本描述，对应 @description
  // - author: 作者，对应 @author
  // - scriptHandler: 固定为 "AUTS"
  // - script: 原始 userscript 元信息对象
  //   - script.name
  //   - script.namespace
  //   - script.version
  //   - script.description
  //   - script.author
  //   - script.matches
  //   - script.excludes
  //   - script.connects
  //   - script.grants
  // - GM_info: AUTS 注入的 GM_info
  //   - GM_info.scriptHandler
  //   - GM_info.version
  //   - GM_info.script
  //     - GM_info.script.name
  //     - GM_info.script.namespace
  //     - GM_info.script.version
  //     - GM_info.script.description
  //     - GM_info.script.author
  //     - GM_info.script.matches
  //     - GM_info.script.excludes
  //     - GM_info.script.connects
  //     - GM_info.script.grants

  // 每个 @require 模块里都可以直接这样写：
  // const info = auts();
  // console.log("[module-a]", info.name, info.version);

  const pluginInfo = auts();

  console.group("[AUTS] Plugin Info Example");
  console.log("main script:", pluginInfo.name, pluginInfo.version, pluginInfo.namespace);
  console.log("module usage: const info = auts();");
  console.groupEnd();

  const banner = document.createElement("div");
  banner.style.cssText = [
    "position: fixed",
    "right: 12px",
    "bottom: 12px",
    "z-index: 2147483647",
    "padding: 10px 12px",
    "border-radius: 10px",
    "background: rgba(17, 24, 39, 0.92)",
    "color: #fff",
    "font: 12px/1.5 monospace",
    "box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28)",
    "max-width: 360px",
    "white-space: pre-wrap",
  ].join(";");
  banner.textContent = [
    "AUTS Plugin Info",
    "module: const info = auts()",
    `name: ${pluginInfo.name}`,
    `namespace: ${pluginInfo.namespace}`,
    `version: ${pluginInfo.version}`,
    `id: ${pluginInfo.id}`,
    `handler: ${pluginInfo.scriptHandler}`,
  ].join("\n");

  if (document.body) {
    document.body.appendChild(banner);
  } else {
    window.addEventListener("DOMContentLoaded", function() {
      document.body.appendChild(banner);
    }, { once: true });
  }
})();