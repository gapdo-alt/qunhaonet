interface LandingOptions {
  code: string;
  host: string;
  /** 二维码版本号（上传时间戳）；为 null 表示尚未上传 */
  version: number | null;
}

/**
 * 预渲染公开展示页（qunhao.net/{code}）。
 * 上传/注册时生成并写入 R2 pages/{code}.html，访问时直接返回，热路径不查 D1。
 * 单文件自包含：CSS 内联、无外部静态资源。
 */
export function renderLandingPage({ code, host, version }: LandingOptions): string {
  const imageUrl = `/i/${code}?v=${version ?? 0}`;
  const body = version
    ? `<img class="qr" src="${imageUrl}" alt="群二维码" width="320" height="320">
      <p class="hint">长按识别或扫码加入群聊</p>`
    : `<div class="empty"><span>暂无二维码</span></div>
      <p class="hint">群主还未上传二维码，请稍后再来</p>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>群号 ${code}</title>
<meta property="og:title" content="群号 ${code}">
<meta property="og:description" content="扫码加入群聊">
<meta property="og:image" content="https://${host}/i/${code}">
<style>
:root{color-scheme:light dark}
*{margin:0;padding:0;box-sizing:border-box}
body{
  min-height:100svh;display:flex;align-items:center;justify-content:center;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  background:#f4f5f7;color:#1a1a2e;padding:24px;
}
main{
  width:100%;max-width:420px;background:#fff;border-radius:20px;
  padding:40px 28px 28px;text-align:center;
  box-shadow:0 8px 32px rgba(0,0,0,.08);
}
.code{
  font-size:30px;font-weight:700;letter-spacing:4px;margin-bottom:24px;
  font-variant-numeric:tabular-nums;
}
.qr{
  width:100%;max-width:320px;height:auto;border-radius:12px;
  border:1px solid rgba(0,0,0,.06);display:block;margin:0 auto;
}
.empty{
  width:100%;max-width:320px;aspect-ratio:1;margin:0 auto;border-radius:12px;
  border:2px dashed rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;
  color:#999;font-size:16px;
}
.hint{margin-top:20px;font-size:14px;color:#888}
footer{margin-top:28px;font-size:12px;color:#bbb}
footer a{color:inherit;text-decoration:none}
@media (prefers-color-scheme:dark){
  body{background:#101014;color:#eee}
  main{background:#1b1b22;box-shadow:0 8px 32px rgba(0,0,0,.4)}
  .qr{border-color:rgba(255,255,255,.08);background:#fff}
  .empty{border-color:rgba(255,255,255,.18);color:#777}
  footer{color:#555}
}
</style>
</head>
<body>
<main>
  <p class="code">${code}</p>
  ${body}
  <footer><a href="https://${host}/">${host}</a></footer>
</main>
</body>
</html>`;
}

/** 未知群号的 404 页面 */
export function renderNotFoundPage(host: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>群号不存在</title>
<style>
:root{color-scheme:light dark}
body{min-height:100svh;display:flex;align-items:center;justify-content:center;
font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
background:#f4f5f7;color:#666;text-align:center;padding:24px}
@media (prefers-color-scheme:dark){body{background:#101014;color:#999}}
a{color:inherit}
</style>
</head>
<body>
<div>
  <h1 style="font-size:48px;margin-bottom:12px">404</h1>
  <p>该群号不存在或已停用</p>
  <p style="margin-top:20px;font-size:13px"><a href="https://${host}/">${host}</a></p>
</div>
</body>
</html>`;
}
