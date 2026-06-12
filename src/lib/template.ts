export interface LandingOptions {
  code: string;
  host: string;
  /** 群名称 */
  name: string;
  platform: 'wechat' | 'feishu' | null;
  /** 二维码 C 版本号（上传时间戳）；null 表示尚未上传 */
  version: number | null;
}

const SHARED_CSS = `
:root{color-scheme:light dark}
*{margin:0;padding:0;box-sizing:border-box}
body{
  min-height:100svh;display:flex;align-items:center;justify-content:center;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  background:#f4f5f7;color:#1a1a2e;padding:24px;
}
main{
  width:100%;max-width:420px;background:#fff;border-radius:20px;
  padding:36px 28px 24px;text-align:center;
  box-shadow:0 8px 32px rgba(0,0,0,.08);
}
h1.name{font-size:22px;line-height:1.4;word-break:break-all}
.chip{
  display:inline-flex;align-items:center;gap:6px;margin-top:10px;
  font-size:13px;font-weight:600;padding:4px 12px;border-radius:999px;color:#fff;
}
.chip.wechat{background:#07C160}
.chip.feishu{background:#3370FF}
.chip .dot{width:7px;height:7px;border-radius:50%;background:#fff}
.code-line{margin-top:8px;font-size:14px;color:#999;letter-spacing:2px;font-variant-numeric:tabular-nums}
.qr{
  width:100%;max-width:300px;height:auto;border-radius:12px;margin:20px auto 0;
  border:1px solid rgba(0,0,0,.06);display:block;background:#fff;
}
.empty{
  width:100%;max-width:300px;aspect-ratio:1;margin:20px auto 0;border-radius:12px;
  border:2px dashed rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;
  color:#999;font-size:15px;
}
.hint{margin-top:16px;font-size:14px;color:#888}
.owner-link{
  display:inline-block;margin-top:18px;font-size:13px;color:#4f6ef7;text-decoration:none;
  border-top:1px solid rgba(0,0,0,.06);padding-top:14px;width:100%;
}
footer{margin-top:18px;font-size:12px;color:#bbb}
footer a{color:inherit;text-decoration:none}
@media (prefers-color-scheme:dark){
  body{background:#101014;color:#eee}
  main{background:#1b1b22;box-shadow:0 8px 32px rgba(0,0,0,.4)}
  .qr{border-color:rgba(255,255,255,.08)}
  .empty{border-color:rgba(255,255,255,.18);color:#777}
  .owner-link{border-top-color:rgba(255,255,255,.08)}
  footer{color:#555}
}`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function platformChip(platform: 'wechat' | 'feishu' | null): string {
  if (platform === 'wechat') return '<span class="chip wechat"><span class="dot"></span>微信群</span>';
  if (platform === 'feishu') return '<span class="chip feishu"><span class="dot"></span>飞书群</span>';
  return '';
}

/**
 * 预渲染公开展示页（qunhao.net/{code}），展示二维码 C。
 * 创建/上传时生成并写入 R2 pages/{code}.html，访问热路径不查 D1。
 */
export function renderLandingPage({ code, host, name, platform, version }: LandingOptions): string {
  const safeName = escapeHtml(name);
  const body = version
    ? `<img class="qr" src="/i/${code}?v=${version}" alt="群二维码" width="300" height="300">
  <p class="hint">长按识别二维码，加入群聊</p>`
    : `<div class="empty"><span>暂无二维码</span></div>
  <p class="hint">群主还未上传二维码</p>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${safeName} - 群号 ${code}</title>
<meta property="og:title" content="${safeName}">
<meta property="og:description" content="群号 ${code} · 扫码加入群聊">
<meta property="og:image" content="https://${host}/i/${code}">
<style>${SHARED_CSS}</style>
</head>
<body>
<main>
  <h1 class="name">${safeName}</h1>
  <div>${platformChip(platform)}</div>
  <p class="code-line">群号 ${code}</p>
  ${body}
  <a class="owner-link" href="/owner/${code}">二维码失效？联系群主 →</a>
  <footer><a href="https://${host}/">${host}</a></footer>
</main>
</body>
</html>`;
}

export interface OwnerPageOptions {
  code: string;
  host: string;
  name: string;
  wechatId: string | null;
  hasWechatQr: boolean;
}

/** 群主信息页（动态渲染，资料更新即时生效） */
export function renderOwnerPage({ code, host, name, wechatId, hasWechatQr }: OwnerPageOptions): string {
  const safeName = escapeHtml(name);
  const parts: string[] = [];
  if (wechatId) {
    parts.push(`<p class="hint" style="margin-top:24px">群主微信号</p>
  <p class="wxid" id="wxid">${escapeHtml(wechatId)}</p>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('wxid').textContent).then(()=>{this.textContent='已复制'})">复制微信号</button>`);
  }
  if (hasWechatQr) {
    parts.push(`<p class="hint" style="margin-top:24px">群主微信二维码</p>
  <img class="qr" src="/owner-qr/${code}" alt="群主微信二维码" width="300" height="300">
  <p class="hint">长按识别添加群主</p>`);
  }
  const content = parts.length
    ? parts.join('\n')
    : '<div class="empty"><span>群主暂未填写联系方式</span></div>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>联系群主 - ${safeName}</title>
<style>${SHARED_CSS}
.wxid{margin-top:8px;font-size:20px;font-weight:700;word-break:break-all}
.copy-btn{
  margin-top:12px;padding:8px 20px;font-size:14px;font-weight:600;border:none;border-radius:8px;
  background:#4f6ef7;color:#fff;cursor:pointer;
}</style>
</head>
<body>
<main>
  <h1 class="name">联系群主</h1>
  <p class="code-line">${safeName} · 群号 ${code}</p>
  ${content}
  <a class="owner-link" href="/${code}">← 返回群页面</a>
  <footer><a href="https://${host}/">${host}</a></footer>
</main>
</body>
</html>`;
}
