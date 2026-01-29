/** @type {import('next').NextConfig} */

// 是否为生产打包模式（用于插件上架）
const isExport = process.env.BUILD_MODE === 'export';

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
