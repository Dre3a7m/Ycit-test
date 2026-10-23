// ==UserScript==
// @name         实安课堂 · 视频弹题助手
// @namespace    local.ycit.quiz
// @version      1.1.0
// @description  提前弹出视频章节测验、解除快进锁、改倍速、按题号单独跳题
// @match        https://sa.ycit.edu.cn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TAG = '%c[弹题助手]';
  const CSS = 'color:#0a84ff;font-weight:600';
  const log = (...a) => console.log(TAG, CSS, ...a);

  // ---------- 定位 Vue 组件 ----------
  function findVm() {
    const v = document.querySelector('video');
    if (v) {
      let node = v;
      while (node && !node.__vue__) node = node.parentElement;
      let vm = node && node.__vue__;
      for (let i = 0; i < 6 && vm; i++) {
        if (vm.model && Array.isArray(vm.model.questionRelaList)) return vm;
        vm = vm.$parent;
      }
    }
    const app = document.querySelector('#app');
    const root = app && app.__vue__;
    if (!root) return null;
    let found = null;
    (function walk(c, d) {
      if (found || !c || d > 16) return;
      if (c.model && Array.isArray(c.model.questionRelaList)) found = c;
      (c.$children || []).forEach((x) => walk(x, d + 1));
    })(root, 0);
    return found;
  }

  function getVm() {
    const vm = findVm();
    if (!vm) return null;
    const n = (vm.model.questionRelaList || []).length;
    if (window.__vm !== vm || window.__vmCount !== n) {
      window.__vm = vm;
      window.__vmCount = n;
      log('已绑定组件，弹题数 =', n);
      renderPanel(vm);
    }
    return vm;
  }

  // ---------- 解快进锁 ----------
  function unlockSeek() {
    const v = document.querySelector('video');
    if (!v) return false;
    if (v.__seekUnlocked) return true;
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    if (!desc) return false;
    Object.defineProperty(v, 'currentTime', {
      configurable: true,
      get() { return desc.get.call(this); },
      // 只允许向前跳，忽略组件把进度"拉回"的赋值
      set(x) { if (x >= desc.get.call(this) - 0.5) desc.set.call(this, x); }
    });
    v.__seekUnlocked = true;
    log('快进锁已解除');
    return true;
  }

  // ---------- 核心动作 ----------
  function pop(i) {
    const vm = getVm();
    if (!vm) return log('没找到视频组件');
    const s = vm.model.questionRelaList[i];
    if (!s) return log('没有第 ' + (i + 1) + ' 题');
    vm.showModal = true;
    vm.model.stem = s.stem;
    vm.model.kind = s.kind;
    vm.model.kind_dictText = s.kind_dictText;
    vm.model.isPic = s.isPic;
    vm.model.optiona = s.optiona;
    vm.model.optionb = s.optionb;
    vm.model.optionc = s.optionc;
    vm.model.optiond = s.optiond;
    vm.questionId = s.id;
    vm.option = '';
    vm.selectedValues = [];
    if (vm.$forceUpdate) vm.$forceUpdate();
    log('已弹出第 ' + (i + 1) + ' 题，ejectTime =', s.ejectTime);
  }

  function jump(i) {
    const vm = getVm();
    if (!vm) return log('没找到视频组件');
    const s = vm.model.questionRelaList[i];
    if (!s) return log('没有第 ' + (i + 1) + ' 题');
    const v = document.querySelector('video');
    if (!v) return log('页面上没有 <video>');
    unlockSeek();
    // +0.5 让 parseInt(currentTime) 正好等于 ejectTime，触发组件的相等判断
    v.currentTime = Number(s.ejectTime) + 0.5;
    log('已跳到 ' + s.ejectTime + 's（第 ' + (i + 1) + ' 题）');
  }

  function speed(r) {
    const v = document.querySelector('video');
    if (!v) return log('页面上没有 <video>');
    v.playbackRate = Number(r) || 4;
    log('倍速 =', v.playbackRate);
  }

  function submitAnswer(letter) {
    const vm = getVm();
    if (!vm) return log('没找到视频组件');
    if (String(vm.model.kind) === '3') vm.selectedValues = String(letter).toUpperCase().split('');
    else vm.option = String(letter).toUpperCase();
    vm.submit();
    log('已提交：', letter);
  }

  // ---------- 悬浮面板 ----------
  let panel = null;

  function renderPanel(vm) {
    if (panel) panel.remove();
    const list = vm.model.questionRelaList || [];

    panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647',
      'background:#fff', 'border:1px solid #d9d9d9', 'border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.18)', 'padding:10px 12px',
      'font:13px/1.6 system-ui,Segoe UI,sans-serif', 'color:#333',
      'width:300px'
    ].join(';');

    const head = document.createElement('div');
    head.textContent = '弹题助手 · 共 ' + list.length + ' 题';
    head.style.cssText = 'font-weight:600;margin-bottom:2px;padding-right:18px';
    panel.appendChild(head);

    const tip = document.createElement('div');
    tip.textContent = '上排＝跳到该题触发点，下排＝直接弹出';
    tip.style.cssText = 'color:#999;font-size:11px;margin-bottom:6px';
    panel.appendChild(tip);

    const mk = (label, title, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title || label;
      b.style.cssText = [
        'min-width:34px', 'height:26px', 'padding:0 8px', 'border:1px solid #d9d9d9',
        'background:#fafafa', 'border-radius:6px', 'cursor:pointer',
        'font-size:12px', 'font-family:inherit'
      ].join(';');
      b.onmouseenter = () => { b.style.background = '#e8f2ff'; b.style.borderColor = '#91caff'; };
      b.onmouseleave = () => { b.style.background = '#fafafa'; b.style.borderColor = '#d9d9d9'; };
      b.onclick = fn;
      return b;
    };

    const mkRow = (text, builder) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:6px';
      const lb = document.createElement('span');
      lb.textContent = text;
      lb.style.cssText = 'color:#666;font-size:12px;flex:0 0 auto';
      row.appendChild(lb);
      list.forEach((q, i) => row.appendChild(builder(q, i)));
      return row;
    };

    // 每一题一个跳转按钮
    panel.appendChild(mkRow('跳转', (q, i) =>
      mk('第' + (i + 1) + '题 · ' + q.ejectTime + 's', '把进度跳到 ' + q.ejectTime + ' 秒', () => jump(i))
    ));

    // 每一题一个直接弹出按钮
    panel.appendChild(mkRow('弹出', (q, i) =>
      mk(String(i + 1), '直接弹出第 ' + (i + 1) + ' 题', () => pop(i))
    ));

    const tools = document.createElement('div');
    tools.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const lb = document.createElement('span');
    lb.textContent = '工具';
    lb.style.cssText = 'color:#666;font-size:12px';
    tools.appendChild(lb);
    tools.appendChild(mk('解锁快进', '解除 3 秒快进回拉', () => unlockSeek()));
    tools.appendChild(mk('8x', '播放倍速设为 8', () => speed(8)));
    tools.appendChild(mk('列表', '在控制台打印全部题目', () => window.YQ.list()));
    panel.appendChild(tools);

    const close = document.createElement('span');
    close.textContent = '×';
    close.style.cssText = 'position:absolute;top:4px;right:8px;cursor:pointer;color:#999;font-size:16px';
    close.onclick = () => panel.remove();
    panel.appendChild(close);

    document.body.appendChild(panel);
  }

  // ---------- 暴露 API ----------
  window.YQ = {
    list() {
      const vm = getVm();
      if (!vm) return console.warn('没找到视频组件');
      console.table(vm.model.questionRelaList.map((q, i) => ({ 序号: i + 1, ejectTime: q.ejectTime, 题型: q.kind_dictText, 题干: q.stem })));
    },
    pop, jump, speed, submit: submitAnswer, unlockSeek,
    get vm() { return getVm(); }
  };

  // ---------- 轮询等待视频页 ----------
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (panel) panel.remove();
      window.__vm = null;
      window.__vmCount = -1;
      return;
    }
    if (document.querySelector('video')) getVm();
  }, 1200);

  log('已加载 v1.1.0，命令：YQ.list() / YQ.pop(0) / YQ.jump(0) / YQ.speed(8)');
})();
