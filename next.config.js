/** @type {import('next').NextConfig} */

// 仅在 build:export 脚本下启用静态导出，避免运行时被环境变量污染
const isExport =
  process.env.BUILD_MODE === 'export' &&
  process.env.npm_lifecycle_event === 'build:export';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-illustrations'],
  
  // 禁用图片优化（静态导出不支持）
  images: {
    unoptimized: true,
  },
  
  // 生产打包模式：静态导出配置
  ...(isExport ? {
    output: 'export',
    distDir: 'dist',
    basePath: '',
    assetPrefix: './',
    trailingSlash: true,
  } : {}),
}

module.exports = nextConfig
