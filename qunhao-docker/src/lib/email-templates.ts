export function passwordResetEmailHtml(opts: { resetUrl: string; host: string }): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;line-height:1.6;color:#1a1a2e">
  <p>你好，</p>
  <p>我们收到了重置你在 <strong>${opts.host}</strong> 账号密码的请求。</p>
  <p><a href="${opts.resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f6ef7;color:#fff;text-decoration:none;border-radius:8px">重置密码</a></p>
  <p>或复制以下链接到浏览器打开：</p>
  <p style="word-break:break-all;color:#666">${opts.resetUrl}</p>
  <p style="color:#888;font-size:14px">链接 1 小时内有效。如非本人操作，请忽略此邮件。</p>
</body>
</html>`;
}

export function passwordResetEmailText(opts: { resetUrl: string; host: string }): string {
  return `你好，

我们收到了重置你在 ${opts.host} 账号密码的请求。

请打开以下链接重置密码（1 小时内有效）：
${opts.resetUrl}

如非本人操作，请忽略此邮件。`;
}
