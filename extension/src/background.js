// Meem extension · Service Worker 入口
//   · WS bridge → ws.js
//   · popup 通信 / 登录 → popup-bridge.js
//   · 工具实现 → tools/*
//
// 部署地址写在 ../config.js · 不入 git · 仓库里只有 config.example.js
// 此扩展无独立 UI · 用户交互在 Meem 网页上完成 · 这里只是个常驻 worker

import { connect } from './ws.js';
import './popup-bridge.js';

chrome.runtime.onInstalled.addListener(() => { connect(); });
chrome.runtime.onStartup.addListener(() => { connect(); });
connect();
