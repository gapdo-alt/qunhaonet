/**
 * 客户端二维码工具（依赖 vendor/jsQR.js 与 vendor/qrcode.js）
 * - decodeQrFromFile: 从用户上传的图片中解析二维码内容（二维码 B）
 * - detectPlatform:  根据域名识别微信群 / 飞书群
 * - renderQrPng:     以统一风格重绘二维码（二维码 A / C），中心嵌入平台 logo，输出 PNG Blob
 */
(function (global) {
  'use strict';

  var QR_LOGOS = {
    wechat:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
          '<rect width="96" height="96" rx="20" fill="#07C160"/>' +
          '<path fill="#fff" d="M39 25c-12.7 0-23 8.4-23 18.8 0 6 3.4 11.3 8.7 14.7l-2.2 6.7 7.7-4c2.8.9 5.8 1.4 8.8 1.4.8 0 1.6 0 2.4-.1-.6-1.7-.9-3.5-.9-5.4 0-10.2 9.9-18.5 22-18.5.6 0 1.2 0 1.8.1C62.2 30.9 51.6 25 39 25z"/>' +
          '<path fill="#fff" d="M62.5 42.5c-10.2 0-18.5 6.9-18.5 15.4S52.3 73.3 62.5 73.3c2.7 0 5.2-.5 7.5-1.3l6.3 3.3-1.8-5.6c4.1-2.8 6.5-7 6.5-11.8 0-8.5-8.3-15.4-18.5-15.4z"/>' +
          '<circle cx="31.5" cy="40" r="3" fill="#07C160"/>' +
          '<circle cx="46.5" cy="40" r="3" fill="#07C160"/>' +
          '<circle cx="56.5" cy="55.5" r="2.5" fill="#07C160"/>' +
          '<circle cx="68.5" cy="55.5" r="2.5" fill="#07C160"/>' +
          '</svg>'
      ),
    feishu:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
          '<rect width="96" height="96" rx="20" fill="#3370FF"/>' +
          '<path fill="#fff" d="M18 36h26l8 10c-6 10-15 18-27 22l-7 2 6-9c-4-7-6-16-6-25z"/>' +
          '<path fill="#fff" opacity=".85" d="M50 32l28-8-10 26c-2 5-5 9-9 13-3-7-7-13-12-19l3-12z"/>' +
          '</svg>'
      ),
    qunhao:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
          '<rect width="96" height="96" rx="20" fill="#4F6EF7"/>' +
          '<text x="48" y="64" font-size="46" text-anchor="middle" fill="#fff" font-weight="700" ' +
          'font-family="-apple-system,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif">\u7fa4</text>' +
          '</svg>'
      ),
  };

  function bitmapToImageData(bitmap, maxSide) {
    var scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    var w = Math.max(1, Math.round(bitmap.width * scale));
    var h = Math.max(1, Math.round(bitmap.height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  function fileToImageDataViaImage(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(bitmapToImageData(img, maxSide));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取图片，请换一张 PNG/JPEG 格式的截图'));
      };
      img.src = url;
    });
  }

  function fileToImageData(file, maxSide) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file)
        .then(function (bitmap) { return bitmapToImageData(bitmap, maxSide); })
        .catch(function () { return fileToImageDataViaImage(file, maxSide); });
    }
    return fileToImageDataViaImage(file, maxSide);
  }

  /** 解析图片中的二维码，多尺度尝试；失败返回 null */
  async function decodeQrFromFile(file) {
    var sides = [1000, 1600, 640];
    for (var i = 0; i < sides.length; i++) {
      try {
        var img = await fileToImageData(file, sides[i]);
        var result = global.jsQR(img.data, img.width, img.height);
        if (result && result.data) return result.data.trim();
      } catch (e) {
        /* 尝试下一尺度 */
      }
    }
    return null;
  }

  /** 'wechat' | 'feishu' | null */
  function detectPlatform(text) {
    try {
      var h = new URL(text).hostname;
      if (h === 'weixin.qq.com' || /\.weixin\.qq\.com$/.test(h)) return 'wechat';
      if (h === 'feishu.cn' || /\.feishu\.cn$/.test(h)) return 'feishu';
    } catch (e) {
      /* 非 URL 内容 */
    }
    return null;
  }

  function loadLogo(kind) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = QR_LOGOS[kind];
    });
  }

  function pathRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * 统一风格二维码：白底深色模块、H 级纠错、中心 logo（约 20% 面积）
   * 返回 Promise<Blob>（image/png）
   */
  async function renderQrPng(text, logoKind, size) {
    if (typeof global.qrcode !== 'function') {
      throw new Error('二维码库未加载，请刷新页面后重试');
    }
    size = size || 660;
    var qr = global.qrcode(0, 'H');
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var quiet = 4;
    var mod = Math.max(2, Math.floor(size / (count + quiet * 2)));
    var real = mod * (count + quiet * 2);

    var canvas = document.createElement('canvas');
    canvas.width = real;
    canvas.height = real;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, real, real);
    ctx.fillStyle = '#141420';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * mod, (r + quiet) * mod, mod, mod);
      }
    }

    if (logoKind && QR_LOGOS[logoKind]) {
      var logo = await loadLogo(logoKind);
      var lsize = Math.round(real * 0.2);
      var pad = Math.round(lsize * 0.14);
      var pos = Math.round((real - lsize) / 2);
      pathRoundRect(ctx, pos - pad, pos - pad, lsize + pad * 2, lsize + pad * 2, Math.round(lsize * 0.24));
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(logo, pos, pos, lsize, lsize);
    }

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('二维码生成失败，请刷新页面后重试'));
      }, 'image/png');
    });
  }

  global.QrTools = {
    decodeQrFromFile: decodeQrFromFile,
    detectPlatform: detectPlatform,
    renderQrPng: renderQrPng,
  };
})(window);
