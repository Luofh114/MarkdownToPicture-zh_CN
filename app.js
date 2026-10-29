/* txt → LaTeX + Markdown 图片
 * 纯前端：marked 渲染 Markdown，KaTeX 渲染 LaTeX，foreignObject + canvas 导出 PNG。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 内容样式（页面预览与导出图片共用同一份，保证所见即所得）            */
  /* ------------------------------------------------------------------ */
  var CONTENT_CSS = [
    '.md-body{margin:0;color:#1f2328;line-height:1.75;word-wrap:break-word;overflow-wrap:anywhere;',
    'font-family:"Segoe UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",system-ui,sans-serif;}',
    '.md-body > :first-child{margin-top:0}',
    '.md-body > :last-child{margin-bottom:0}',
    '.md-body p{margin:.62em 0}',
    '.md-body h1,.md-body h2,.md-body h3,.md-body h4,.md-body h5,.md-body h6{',
    'margin:1.15em 0 .5em;line-height:1.35;font-weight:700;color:#111827;}',
    '.md-body h1{font-size:1.75em;padding-bottom:.28em;border-bottom:1px solid #e5e7eb}',
    '.md-body h2{font-size:1.4em;padding-bottom:.22em;border-bottom:1px solid #eef0f4}',
    '.md-body h3{font-size:1.2em}',
    '.md-body h4{font-size:1.05em}',
    '.md-body h5,.md-body h6{font-size:1em;color:#4b5563}',
    '.md-body ul,.md-body ol{margin:.6em 0;padding-left:1.7em}',
    '.md-body li{margin:.22em 0}',
    '.md-body li > ul,.md-body li > ol{margin:.2em 0}',
    '.md-body blockquote{margin:.8em 0;padding:.15em 1em;border-left:4px solid #cbd5e1;color:#4b5563;background:#f8fafc}',
    '.md-body code{font-family:"Cascadia Mono",Consolas,"JetBrains Mono",monospace;font-size:.88em;',
    'background:#f1f3f7;padding:.16em .4em;border-radius:5px}',
    '.md-body pre{margin:.8em 0;padding:.85em 1em;background:#f6f8fa;border:1px solid #eaeef3;',
    'border-radius:10px;overflow-x:auto;line-height:1.55}',
    '.md-body pre code{background:none;border:0;padding:0;font-size:.86em;white-space:pre}',
    '.md-body table{border-collapse:collapse;margin:.9em 0;font-size:.95em}',
    '.md-body th,.md-body td{border:1px solid #d8dee8;padding:.4em .8em;text-align:left}',
    '.md-body th{background:#f4f6fa;font-weight:600}',
    '.md-body a{color:#0b62d6;text-decoration:none;border-bottom:1px solid rgba(11,98,214,.35)}',
    '.md-body img{max-width:100%}',
    '.md-body hr{margin:1.4em 0;border:0;border-top:1px solid #e2e6ee}',
    '.md-body .katex-display{margin:.85em 0;overflow:visible}',
    '.md-body .math-error{color:#b42318;background:#fee4e2;padding:.1em .35em;border-radius:4px}',
    '.md-body .katex{font-size:1.08em}'
  ].join('');

  /* ------------------------------------------------------------------ */
  /* 常量                                                                */
  /* ------------------------------------------------------------------ */
  var MATH_ENVS = {
    'equation': 1, 'equation*': 1, 'displaymath': 1, 'math': 1,
    'align': 1, 'align*': 1, 'alignat': 1, 'alignat*': 1,
    'gather': 1, 'gather*': 1, 'multline': 1, 'multline*': 1,
    'eqnarray': 1, 'eqnarray*': 1, 'split': 1
  };
  var UNWRAP_ENVS = { 'equation': 1, 'equation*': 1, 'displaymath': 1, 'math': 1 };

  var SAMPLE = [
    '# 拉格朗日乘子法',
    '',
    '求解约束优化问题时，可以把目标函数与约束条件组合成',
    '',
    '$$ \\mathcal{L}(x,\\lambda) = f(x) + \\sum_{i=1}^{m}\\lambda_i\\,g_i(x) $$',
    '',
    '## 一阶必要条件',
    '',
    '在正则点处，存在 $\\lambda^* \\in \\mathbb{R}^m$ 使得',
    '',
    '$$ \\nabla f(x^*) + \\sum_{i=1}^{m}\\lambda_i^* \\nabla g_i(x^*) = 0, \\qquad \\lambda_i^* g_i(x^*)=0 $$',
    '',
    '用矩阵形式可以写成',
    '',
    '$$ \\begin{pmatrix} H & J^{\\top} \\\\ J & 0 \\end{pmatrix}',
    '   \\begin{pmatrix} \\Delta x \\\\ \\Delta \\lambda \\end{pmatrix}',
    '   = -\\begin{pmatrix} \\nabla f \\\\ g \\end{pmatrix} $$',
    '',
    '## 经典不等式',
    '',
    '- 柯西不等式：$\\left(\\sum a_i b_i\\right)^2 \\le \\left(\\sum a_i^2\\right)\\left(\\sum b_i^2\\right)$',
    '- 积分形式：$\\displaystyle\\int_0^1 f(x)^2\\,dx \\ge \\left(\\int_0^1 f(x)\\,dx\\right)^2$',
    '',
    '| 方法 | 收敛速度 | 计算量 |',
    '| --- | --- | --- |',
    '| 梯度下降 | 线性 | 小 |',
    '| 牛顿法 | 二次 | 大 |',
    '',
    '> 摘自课件笔记：**拉格朗日对偶**与 KKT 条件。',
    '',
    '```python',
    'import numpy as np',
    'x = np.linspace(0, 1, 100)',
    '```'
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /* 样式注入                                                            */
  /* ------------------------------------------------------------------ */
  function injectStyles() {
    var el = document.createElement('style');
    el.id = 'katex-md-style';
    el.textContent = (window.KATEX_EMBEDDED_CSS || '') + '\n' + CONTENT_CSS;
    document.head.appendChild(el);
  }

  /* ------------------------------------------------------------------ */
  /* LaTeX 提取                                                          */
  /* ------------------------------------------------------------------ */
  function extractMath(src, math) {
    var out = '';
    var buf = '';
    var lines = src.split('\n');
    var inFence = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = line.replace(/^\s+/, '');

      if (!inFence && /^(`{3,}|~{3,})/.test(t)) {
        out += inlineChunk(buf, math);
        buf = '';
        inFence = true;
        out += line + '\n';
        continue;
      }
      if (inFence) {
        out += line + '\n';
        if (/^(`{3,}|~{3,})\s*$/.test(t)) inFence = false;
        continue;
      }
      buf += line + '\n';
    }
    out += inlineChunk(buf, math);
    return out;
  }

  function inlineChunk(text, math) {
    var res = '';
    var i = 0;
    var n = text.length;

    function push(tex, display) {
      var idx = math.length;
      math.push({ tex: tex, display: display });
      return 'XKMATHTOKEN' + idx + 'X';
    }

    while (i < n) {
      var c = text[i];

      if (c === '\\') {
        if (text[i + 1] === '$') { res += '$'; i += 2; continue; }
        if (text[i + 1] === '[') {
          var e1 = text.indexOf('\\]', i + 2);
          if (e1 !== -1) { res += push(text.slice(i + 2, e1), true); i = e1 + 2; continue; }
        }
        if (text[i + 1] === '(') {
          var e2 = text.indexOf('\\)', i + 2);
          if (e2 !== -1) { res += push(text.slice(i + 2, e2), false); i = e2 + 2; continue; }
        }
        if (text.substr(i, 7) === '\\begin{') {
          var m = /^\\begin\{([A-Za-z*]+)\}/.exec(text.slice(i));
          if (m && MATH_ENVS[m[1]]) {
            var endTag = '\\end{' + m[1] + '}';
            var e3 = text.indexOf(endTag, i + m[0].length);
            if (e3 !== -1) {
              res += push(text.slice(i, e3 + endTag.length), true);
              i = e3 + endTag.length;
              continue;
            }
          }
        }
        res += c;
        i += 1;
        continue;
      }

      if (c === '`') {
        var run = /^`+/.exec(text.slice(i))[0];
        var e4 = text.indexOf(run, i + run.length);
        if (e4 !== -1) { res += text.slice(i, e4 + run.length); i = e4 + run.length; continue; }
        res += run;
        i += run.length;
        continue;
      }

      if (c === '$' && text[i + 1] === '$') {
        var e5 = text.indexOf('$$', i + 2);
        if (e5 !== -1) { res += push(text.slice(i + 2, e5), true); i = e5 + 2; continue; }
      }

      if (c === '$') {
        var e6 = findInlineClose(text, i + 1);
        if (e6 !== -1 && e6 > i + 1) {
          res += push(text.slice(i + 1, e6), false);
          i = e6 + 1;
          continue;
        }
      }

      res += c;
      i += 1;
    }
    return res;
  }

  function findInlineClose(text, from) {
    for (var j = from; j < text.length; j++) {
      var ch = text[j];
      if (ch === '\n') return -1;
      if (ch === '\\') { j += 1; continue; }
      if (ch === '$') {
        if (j === from) return -1;           // "$ $"
        if (/\s/.test(text[j - 1])) return -1; // 结束符前不能是空白
        return j;
      }
    }
    return -1;
  }

  function renderMath(tex, display) {
    var src = tex;
    if (display) {
      var m = /^\\begin\{([A-Za-z*]+)\}([\s\S]*)\\end\{\1\}$/.exec(tex.trim());
      if (m && UNWRAP_ENVS[m[1]]) src = m[2];
    }
    try {
      return katex.renderToString(src, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        output: 'htmlAndMathml'
      });
    } catch (err) {
      return '<code class="math-error">' + escapeHtml(tex) + '</code>';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------ */
  /* Markdown + LaTeX → HTML                                             */
  /* ------------------------------------------------------------------ */
  function buildHtml(src) {
    var math = [];
    var plain = extractMath(src, math);
    var html = marked.parse(plain, { gfm: true, breaks: true, headerIds: false, mangle: false });

    for (var i = 0; i < math.length; i++) {
      math[i].html = renderMath(math[i].tex, math[i].display);
    }

    // 独占一段的块级公式：去掉包裹的 <p>
    html = html.replace(/<p>\s*XKMATHTOKEN(\d+)X\s*<\/p>/g, function (all, idx) {
      var item = math[+idx];
      if (item && item.display) return item.html;
      return all;
    });
    // 其余行内公式
    html = html.replace(/XKMATHTOKEN(\d+)X/g, function (all, idx) {
      var item = math[+idx];
      return item ? item.html : all;
    });

    return html;
  }

  /* ------------------------------------------------------------------ */
  /* DOM helpers                                                         */
  /* ------------------------------------------------------------------ */
  var $ = function (id) { return document.getElementById(id); };

  var els = {};

  function readOptions() {
    var bgMap = { white: '#ffffff', paper: '#fbf8f1', transparent: 'transparent' };
    return {
      width: clamp(Number(els.widthNum.value) || 800, 200, 4000),
      pad: clamp(Number(els.padNum.value) || 0, 0, 200),
      fontSize: clamp(Number(els.fontNum.value) || 16, 8, 64),
      scale: Number(els.scaleSelect.value) || 2,
      bg: els.bgSelect.value,
      bgCss: bgMap[els.bgSelect.value] || '#ffffff'
    };
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function syncPair(numEl, rangeEl, outEl, unit) {
    var v = numEl.value;
    if (outEl) outEl.textContent = v + unit;
    rangeEl.value = clamp(Number(v) || 0, Number(rangeEl.min), Number(rangeEl.max));
  }

  /* ------------------------------------------------------------------ */
  /* 预览渲染                                                             */
  /* ------------------------------------------------------------------ */
  var state = { html: '', rendered: false };

  function renderPreview() {
    var o = readOptions();
    var innerW = Math.max(80, o.width - o.pad * 2);

    state.html = buildHtml(els.source.value);

    els.previewBody.innerHTML = state.html;
    els.previewBody.style.width = innerW + 'px';
    els.previewBody.style.fontSize = o.fontSize + 'px';

    els.previewPaper.style.width = o.width + 'px';
    els.previewPaper.style.padding = o.pad + 'px';
    els.previewPaper.style.background = o.bgCss;

    var fit = els.previewPaper.dataset.fit === '1';
    els.previewPaper.style.zoom = fit ? String(Math.min(1, (els.previewScroll.clientWidth - 34) / o.width)) : '';

    updateHint(o, innerW);
    state.rendered = true;

    if (els.previewBody.scrollWidth > innerW + 2) {
      setStatus('有公式或表格比图片宽度更宽，导出时会被裁切，建议加大「图片宽度」', 'error');
    } else if (hasLocalImages()) {
      setStatus('内容里有本地图片：用 file:// 打开时浏览器禁止读取，导出会缺图，请改用 serve.bat（本地 http）打开', 'error');
    } else if (els.status.classList.contains('error')) {
      setStatus('');
    }
  }

  // 内容引用了非 data: 图片，且当前是 file:// 打开
  function hasLocalImages() {
    return location.protocol === 'file:' &&
      /!\[[^\]]*\]\(\s*(?!data:)/.test(els.source.value);
  }

  function updateHint(o, innerW) {
    var h = Math.ceil(els.previewBody.getBoundingClientRect().height / (Number(els.previewPaper.style.zoom) || 1));
    var totalH = h + o.pad * 2;
    els.sizeHint.textContent = o.width + ' × ' + totalH + ' px · 导出 ' +
      Math.round(o.width * o.scale) + ' × ' + Math.round(totalH * o.scale) + ' px';
  }

  /* ------------------------------------------------------------------ */
  /* 导出 PNG                                                            */
  /* ------------------------------------------------------------------ */
  function buildExportNode(html, o) {
    var innerW = Math.max(80, o.width - o.pad * 2);

    var wrap = document.createElement('div');
    wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrap.style.cssText = [
      'margin:0',
      'box-sizing:border-box',
      'width:' + o.width + 'px',
      'height:' + o.height + 'px',
      'padding:' + o.pad + 'px',
      'background:' + o.bgCss,
      'overflow:hidden'
    ].join(';');

    var styleEl = document.createElement('style');
    styleEl.textContent = (window.KATEX_EMBEDDED_CSS || '') + '\n' + CONTENT_CSS;
    wrap.appendChild(styleEl);

    var body = document.createElement('div');
    body.className = 'md-body';
    body.style.cssText = 'width:' + innerW + 'px;font-size:' + o.fontSize + 'px;';
    body.innerHTML = html;
    wrap.appendChild(body);

    return wrap;
  }

  /* 把内容里的外部图片抓成 data URI —— SVG foreignObject 里加载不了外部资源 */
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  function waitImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    return Promise.all(imgs.map(function (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise(function (resolve) {
        var done = function () { resolve(); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 3000);
      });
    }));
  }

  async function inlineImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    var failed = [];

    await Promise.all(imgs.map(async function (img) {
      var src = img.getAttribute('src') || '';
      if (!src || /^data:/i.test(src)) return;
      try {
        var resp = await fetch(src, { cache: 'force-cache' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var blob = await resp.blob();
        if (!/^image\//.test(blob.type)) throw new Error('不是图片');
        img.setAttribute('src', await blobToDataURL(blob));
      } catch (err) {
        failed.push({ src: src, reason: err.message });
      }
    }));

    await waitImages(root);
    return failed;
  }

  async function prepareHtml(html) {
    var box = document.createElement('div');
    box.innerHTML = html;
    var failed = await inlineImages(box);
    return { html: box.innerHTML, failed: failed };
  }

  function measure(html, o) {
    var innerW = Math.max(80, o.width - o.pad * 2);
    var holder = document.createElement('div');
    holder.className = 'md-body';
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;' +
      'width:' + innerW + 'px;font-size:' + o.fontSize + 'px;';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    return waitImages(holder).then(function () {
      var h = Math.ceil(holder.getBoundingClientRect().height);
      document.body.removeChild(holder);
      return h;
    });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片渲染失败')); };
      img.src = url;
    });
  }

  async function exportPng(o) {
    if (!state.html) state.html = buildHtml(els.source.value);

    await document.fonts.ready;

    var prepared = await prepareHtml(state.html);
    var html = prepared.html;

    var contentH = await measure(html, o);
    o.height = Math.max(contentH + o.pad * 2, 80);

    var maxSide = 32000;
    if (o.width * o.scale > maxSide || o.height * o.scale > maxSide) {
      throw new Error('图片尺寸超出浏览器上限（' + maxSide + 'px），请减小宽度或清晰度');
    }

    var node = buildExportNode(html, o);
    var xhtml = new XMLSerializer().serializeToString(node);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + o.width + '" height="' + o.height +
      '" viewBox="0 0 ' + o.width + ' ' + o.height + '">' +
      '<foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + '</foreignObject></svg>';

    // 用 data URI（而不是 blob:）载入，避免 canvas 被标记为「污染」后无法 toBlob
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    var img = await loadImage(url);

    var canvas = document.createElement('canvas');
    canvas.width = Math.round(o.width * o.scale);
    canvas.height = Math.round(o.height * o.scale);
    var ctx = canvas.getContext('2d');
    if (o.bg !== 'transparent') {
      ctx.fillStyle = o.bgCss;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(o.scale, 0, 0, o.scale, 0, 0);
    ctx.drawImage(img, 0, 0, o.width, o.height);

    var blob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b); else reject(new Error('图片编码失败'));
      }, 'image/png');
    });

    return { blob: blob, failed: prepared.failed };
  }

  function setStatus(msg, kind) {
    els.status.textContent = msg || '';
    els.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function imageWarning(failed) {
    if (!failed || !failed.length) return '';
    var names = failed.map(function (f) {
      var s = f.src.length > 42 ? f.src.slice(0, 39) + '…' : f.src;
      return s;
    });
    var tip = location.protocol === 'file:'
      ? '（本地打开时浏览器禁止读取图片文件，请用 serve.bat 通过 http 打开）'
      : '（跨域图片需要对方允许 CORS）';
    return failed.length + ' 张图片无法嵌入，导出图中会缺失：' + names.join('、') + tip;
  }

  async function download() {
    if (!els.source.value.trim()) {
      setStatus('请先上传或输入内容', 'error');
      return;
    }
    els.downloadBtn.disabled = true;
    setStatus('正在生成图片…');
    try {
      var o = readOptions();
      var result = await exportPng(o);
      var blob = result.blob;
      var name = (els.nameInput.value || 'latex-markdown').replace(/[\\/:*?"<>|]+/g, '-');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '-' + o.width + 'x' + o.height + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

      var img = els.resultImg;
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.dataset.url = URL.createObjectURL(blob);
      img.src = img.dataset.url;
      els.resultWrap.hidden = false;

      var warn = imageWarning(result.failed);
      if (warn) {
        setStatus('已生成 ' + o.width + ' × ' + o.height + ' px，但 ' + warn, 'error');
      } else {
        setStatus('已生成 ' + o.width + ' × ' + o.height + ' px（' + o.scale + '× 输出）', 'ok');
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || '生成失败，请使用 Edge / Chrome 打开本页面', 'error');
    } finally {
      els.downloadBtn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 文件读取                                                            */
  /* ------------------------------------------------------------------ */
  var TEXT_EXT = /\.(txt|md|markdown|mdown|mkd|tex|latex)$/i;

  function decode(buf) {
    var utf8 = new TextDecoder('utf-8').decode(buf);
    if (utf8.indexOf('\uFFFD') === -1) return utf8;
    try {
      var gbk = new TextDecoder('gbk').decode(buf);
      if (gbk.indexOf('\uFFFD') === -1) return gbk;
    } catch (e) { /* 浏览器不支持 gbk 时忽略 */ }
    return utf8;
  }

  function loadFile(file) {
    if (!file) return;
    if (!TEXT_EXT.test(file.name) && file.type && file.type.indexOf('text') !== 0) {
      setStatus('请选择 txt / md / tex 文本文件', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var text = decode(new Uint8Array(reader.result)).replace(/^\uFEFF/, '');
      els.source.value = text;
      els.nameInput.value = file.name.replace(/\.[^.]+$/, '');
      els.fileMeta.textContent = file.name + ' · ' + (file.size / 1024).toFixed(1) + ' KB';
      setStatus('');
      renderPreview();
    };
    reader.onerror = function () { setStatus('文件读取失败', 'error'); };
    reader.readAsArrayBuffer(file);
  }

  /* ------------------------------------------------------------------ */
  /* 初始化                                                              */
  /* ------------------------------------------------------------------ */
  function init() {
    els = {
      dropzone: $('dropzone'),
      fileInput: $('fileInput'),
      source: $('source'),
      fileMeta: $('fileMeta'),
      widthRange: $('widthRange'),
      widthNum: $('widthNum'),
      widthOut: $('widthOut'),
      padRange: $('padRange'),
      padNum: $('padNum'),
      padOut: $('padOut'),
      fontRange: $('fontRange'),
      fontNum: $('fontNum'),
      fontOut: $('fontOut'),
      scaleSelect: $('scaleSelect'),
      bgSelect: $('bgSelect'),
      nameInput: $('nameInput'),
      downloadBtn: $('downloadBtn'),
      fitBtn: $('fitBtn'),
      status: $('status'),
      previewScroll: $('previewScroll'),
      previewPaper: $('previewPaper'),
      previewBody: $('previewBody'),
      sizeHint: $('sizeHint'),
      resultWrap: $('resultWrap'),
      resultImg: $('resultImg')
    };

    injectStyles();

    var pending = null;
    function scheduleRender() {
      clearTimeout(pending);
      pending = setTimeout(renderPreview, 180);
    }

    // 尺寸控件
    els.widthRange.addEventListener('input', function () {
      els.widthNum.value = els.widthRange.value;
      els.widthOut.textContent = els.widthRange.value + ' px';
      renderPreview();
    });
    els.widthNum.addEventListener('input', function () {
      syncPair(els.widthNum, els.widthRange, null, '');
      scheduleRender();
    });
    els.widthNum.addEventListener('change', function () {
      els.widthNum.value = clamp(Number(els.widthNum.value) || 800, 200, 4000);
      syncPair(els.widthNum, els.widthRange, els.widthOut, ' px');
      renderPreview();
    });

    els.padRange.addEventListener('input', function () {
      els.padNum.value = els.padRange.value;
      els.padOut.textContent = els.padRange.value + ' px';
      renderPreview();
    });
    els.padNum.addEventListener('input', function () {
      els.padRange.value = clamp(Number(els.padNum.value) || 0, 0, 120);
      els.padOut.textContent = (Number(els.padNum.value) || 0) + ' px';
      renderPreview();
    });

    els.fontRange.addEventListener('input', function () {
      els.fontNum.value = els.fontRange.value;
      els.fontOut.textContent = els.fontRange.value + ' px';
      renderPreview();
    });
    els.fontNum.addEventListener('input', function () {
      els.fontRange.value = clamp(Number(els.fontNum.value) || 16, 10, 48);
      els.fontOut.textContent = (Number(els.fontNum.value) || 16) + ' px';
      renderPreview();
    });

    els.scaleSelect.addEventListener('change', renderPreview);
    els.bgSelect.addEventListener('change', renderPreview);

    // 文本输入
    els.source.addEventListener('input', scheduleRender);

    // 上传
    els.fileInput.addEventListener('change', function () {
      loadFile(this.files && this.files[0]);
      this.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      els.dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropzone.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      els.dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropzone.classList.remove('drag');
      });
    });
    els.dropzone.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) loadFile(dt.files[0]);
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    // 按钮
    els.downloadBtn.addEventListener('click', download);
    els.fitBtn.addEventListener('click', function () {
      var on = els.previewPaper.dataset.fit === '1';
      els.previewPaper.dataset.fit = on ? '0' : '1';
      els.fitBtn.textContent = on ? '适应宽度' : '原始大小';
      renderPreview();
    });
    $('sampleBtn').addEventListener('click', function () {
      els.source.value = SAMPLE;
      els.nameInput.value = 'latex-markdown';
      els.fileMeta.textContent = '示例内容';
      renderPreview();
    });
    $('clearBtn').addEventListener('click', function () {
      els.source.value = '';
      els.fileMeta.textContent = '';
      els.resultWrap.hidden = true;
      renderPreview();
    });

    // Ctrl/Cmd + S 直接下载
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        download();
      }
    });

    // 自适应预览区宽度变化
    window.addEventListener('resize', function () {
      if (els.previewPaper.dataset.fit === '1') renderPreview();
    });

    // 初始内容：有示例文件则读取，否则用内置示例
    els.previewPaper.dataset.fit = '1';
    els.fitBtn.textContent = '原始大小';
    els.source.value = SAMPLE;
    renderPreview();

    var params = new URLSearchParams(location.search);
    if (params.has('selftest')) runSelftest();
  }

  async function runSelftest() {
    try {
      document.title = 'SELFTEST_RUNNING';
      state.html = buildHtml(SAMPLE);
      var o = readOptions();
      var result = await exportPng(o);
      var blob = result.blob;
      els.resultImg.src = URL.createObjectURL(blob);
      els.resultWrap.hidden = false;

      // 自检用：把导出结果以 dataURL 挂到 DOM，便于外部抓取原图
      var dataUrl = await new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.readAsDataURL(blob);
      });
      var probe = document.createElement('img');
      probe.id = 'selftest-full';
      probe.src = dataUrl;
      probe.style.display = 'none';
      document.body.appendChild(probe);

      document.title = 'SELFTEST_OK' + (result.failed.length ? ' failed=' + result.failed.length : '');
    } catch (err) {
      console.error(err);
      document.title = 'SELFTEST_FAIL: ' + (err && err.message);
      setStatus('自检失败：' + err.message, 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
