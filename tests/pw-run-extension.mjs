// pw-run-extension.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const EXT_PATH = '/Users/ann/Workspace/auts/dist/extension';   // 扩展打包目录
const START_URL = 'https://lms.ouchn.cn/user/courses#/';
const USER_DATA_DIR = '/tmp/auts-pw-profile'; // 使用持久化上下文以加载扩展
const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 900;
const LOCALE = 'zh-CN';
const TIMEZONE = 'Asia/Shanghai';

if (!fs.existsSync(EXT_PATH)) {
  console.error('Extension not found:', EXT_PATH);
  process.exit(1);
}

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  // 使用系统 Chrome，降低被风控识别概率
  channel: 'chrome',
  headless: false, // 扩展要求非无头
  // 让页面视口跟随真实窗口大小，避免默认 1280x720 视口导致页面未铺满
  viewport: null,
  locale: LOCALE,
  timezoneId: TIMEZONE,
  // 去掉自动化标志位参数
  ignoreDefaultArgs: ['--enable-automation'],
  args: [
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
    '--lang=zh-CN',
    '--disable-blink-features=AutomationControlled',
    // `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
    '--start-maximized',
  ],
});

// 在所有页面注入脚本，隐藏常见自动化指纹
await context.addInitScript(() => {
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  } catch {}
  try {
    // languages 与 plugins
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  } catch {}
  try {
    if (!window.chrome) window.chrome = { runtime: {} };
  } catch {}
});

// MV3: 服务工作线程日志（可选）
context.on('serviceworker', sw => {
  sw.on('console', msg => console.log('[ext-sw]', msg.text()));
});

// 打开一个页面并暴露 AUTS_requestClick 给页面脚本使用
const page = await context.newPage();
await page.exposeFunction('AUTS_requestClick', async (selector) => {
  const locator = page.locator(selector).first();
  await locator.click({ force: true });
});

// 基本日志与风控自检
page.on('console', msg => console.log('[page]', msg.type(), msg.text()));
page.on('response', async (res) => {
  const url = res.url();
  if (/\/am\//.test(url) || /login|oauth|token/i.test(url)) {
    try {
      const status = res.status();
      const body = await res.text();
      console.log('[resp]', status, url.slice(0, 150), body.slice(0, 200));
    } catch {}
  }
});
await page.addInitScript(() => {
  // 方便在 DevTools 中快速确认
  try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch {}
});

await page.goto(START_URL);

// 可选：等待页面可见的元素，确认已加载
// await page.waitForSelector('video', { timeout: 30000 });

console.log('Playwright + Extension is running. Keep browser open.');