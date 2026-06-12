// 验证 qrcode-generator 生成 + jsQR 解码 roundtrip（模拟中心 logo 遮挡 20%）
// 运行：node scripts/qr-roundtrip-test.cjs
const qrcode = require('qrcode-generator');
const jsQR = require('jsqr');

const cases = [
  'https://weixin.qq.com/g/CQYAAAj3A6lmMPdX8KrfWkPMBWm2nd_nCfaDujTyGtM62WQ3YCFNlXlANe8koMaL',
  'https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=115mdca8-8ab6-4f40-b45b-4861a25f474a&qr_code=true',
  'https://qunhao.net/12345',
];

let allOk = true;
for (const url of cases) {
  const qr = qrcode(0, 'H');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const mod = 8;
  const size = (count + quiet * 2) * mod;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      for (let y = 0; y < mod; y++) {
        for (let x = 0; x < mod; x++) {
          const px = (((r + quiet) * mod + y) * size + (c + quiet) * mod + x) * 4;
          data[px] = 20; data[px + 1] = 20; data[px + 2] = 32; data[px + 3] = 255;
        }
      }
    }
  }
  // 模拟中心 logo：20% 边长白块遮挡
  const lsize = Math.round(size * 0.2);
  const start = Math.round((size - lsize) / 2);
  for (let y = 0; y < lsize; y++) {
    for (let x = 0; x < lsize; x++) {
      const px = ((start + y) * size + start + x) * 4;
      data[px] = 255; data[px + 1] = 255; data[px + 2] = 255;
    }
  }
  const res = jsQR(data, size, size);
  const ok = res && res.data === url;
  allOk = allOk && ok;
  console.log((ok ? 'OK  ' : 'FAIL') + ' modules=' + count + ' ' + url.slice(0, 60));
}
process.exit(allOk ? 0 : 1);
