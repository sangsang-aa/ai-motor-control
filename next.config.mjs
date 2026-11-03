/** @type {import('next').NextConfig} */
const nextConfig = {
  // Web 版需要 /api/llm 服务端代理(保护 API key + 绕 CORS),不能静态导出。
  // 后续封装 Electron 时:方案 A = 继续 next start(Electron 内置 Node 可运行);
  // 方案 B = 把代理逻辑搬进 Electron 主进程。见 AGENTS.md。
  // TekHSI 的 gRPC 客户端只在 Node 运行时使用,不要打包进浏览器 bundle。
  serverExternalPackages: ['@grpc/grpc-js', '@grpc/proto-loader']
}

export default nextConfig
