# Simple Userscript Manager

一个简单的 Chrome 扩展，用于管理和执行用户脚本（userscripts）。

## 功能特性

- ✅ 添加、编辑、删除用户脚本
- ✅ 启用/禁用脚本
- ✅ URL 模式匹配（支持通配符 `*`）
- ✅ 脚本导入/导出
- ✅ 基础 GM API 支持
- ✅ 现代化的用户界面

## 安装方法

### 开发者模式安装（推荐）

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本扩展的文件夹
6. 扩展安装完成

## 使用方法

### 添加脚本

1. 点击浏览器工具栏中的扩展图标
2. 点击"管理"按钮进入管理页面
3. 点击"添加新脚本"按钮
4. 填写脚本信息：
   - **脚本名称**: 给脚本起一个描述性的名字
   - **匹配 URL**: 脚本运行的网站，每行一个，支持通配符
   - **排除 URL**: 不运行脚本的网站（可选）
   - **脚本代码**: JavaScript 代码
5. 点击"保存"

### URL 匹配规则

支持使用通配符 `*` 来匹配 URL：

```text
https://example.com/*     - 匹配 example.com 下的所有页面
https://*.google.com/*    - 匹配所有 Google 子域名
*://github.com/*          - 匹配 GitHub 的 HTTP 和 HTTPS 页面
```

### 脚本示例

#### 简单的页面修改脚本

```javascript
// 修改页面标题
document.title = "Modified by Userscript - " + document.title;

// 在页面顶部添加一个通知
const notice = document.createElement("div");
notice.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #4CAF50;
  color: white;
  text-align: center;
  padding: 10px;
  z-index: 9999;
  font-family: Arial, sans-serif;
`;
notice.textContent = "This page is enhanced by userscript!";
document.body.insertBefore(notice, document.body.firstChild);
```

#### 使用 GM API 的脚本

```javascript
// 保存和读取数据
const visitCount = GM_getValue("visitCount", 0) + 1;
GM_setValue("visitCount", visitCount);

console.log(`You have visited this page ${visitCount} times`);

// 显示访问次数
const counter = document.createElement("div");
counter.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 10px;
  border-radius: 5px;
  z-index: 9999;
`;
counter.textContent = `Visit count: ${visitCount}`;
document.body.appendChild(counter);
```

## 支持的 GM API

目前支持以下 Greasemonkey/Tampermonkey API：

- `GM_getValue(key, defaultValue)` - 读取存储的值
- `GM_setValue(key, value)` - 存储值
- `GM_deleteValue(key)` - 删除存储的值
- `GM_info` - 脚本信息对象
- `GM_xmlhttpRequest(details)` - 发送 HTTP 请求（基础功能）

## 文件结构

```text
extension/
├── manifest.json          # 扩展配置文件
├── service_worker.js      # 后台脚本
├── script_storage.js      # 脚本存储模块
├── content_injector.js    # 内容脚本注入器
├── popup.html            # 弹窗界面
├── popup.js              # 弹窗逻辑
├── options.html          # 选项页面
├── options.js            # 选项页面逻辑
└── README.md             # 说明文档
```

## 技术实现

- **Manifest V3**: 使用最新的 Chrome 扩展 API
- **chrome.userScripts API**: 官方用户脚本 API，避免 CSP 限制
- **Service Worker**: 后台脚本处理和脚本注册
- **Content Scripts**: 作为备用注入方案
- **Chrome Storage API**: 脚本数据存储

## 限制和注意事项

1. **安全限制**: 由于 Chrome 的安全策略，某些高级功能可能受限
2. **CSP 限制**: 部分网站的内容安全策略可能阻止脚本执行
3. **API 兼容性**: GM API 实现可能不完整，仅支持基础功能
4. **性能考虑**: 大量脚本可能影响页面加载性能

## 开发和调试

### 调试脚本

1. 打开 Chrome 开发者工具 (F12)
2. 在 Console 中查看脚本输出和错误信息
3. 使用 `console.log()` 进行调试

### 重新加载扩展

修改扩展代码后：

1. 访问 `chrome://extensions/`
2. 找到本扩展
3. 点击刷新按钮

## 故障排除

### 脚本不执行

1. 检查脚本是否已启用
2. 确认 URL 匹配规则正确
3. 查看浏览器控制台是否有错误信息
4. 确认网站没有阻止脚本执行

### 扩展无法加载

1. 确认所有文件都在正确位置
2. 检查 manifest.json 语法是否正确
3. 查看扩展管理页面的错误信息

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0

- 初始版本发布
- 基础脚本管理功能
- 简单的 GM API 支持
- 现代化用户界面
