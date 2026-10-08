// Chỉ nạp bằng start:proxy trên Node local; không nhập vào bundle Next/Cloudflare.
// Node 22.13 fetch không tự đọc HTTP(S)_PROXY như curl/Hardhat.
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

const hasProxy = process.env.https_proxy || process.env.HTTPS_PROXY
  || process.env.http_proxy || process.env.HTTP_PROXY;

if (hasProxy) {
  const noProxy = [process.env.no_proxy ?? process.env.NO_PROXY,
    'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(',');
  setGlobalDispatcher(new EnvHttpProxyAgent({ noProxy }));
  console.log('[local-proxy] Node fetch dùng proxy môi trường; bỏ qua loopback.');
}
