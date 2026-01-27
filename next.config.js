/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-illustrations'],
  
  // 静态导出配置
  output: 'export',
  distDir: 'dist',
  
  // 使用相对路径（重要：插件上架必需）
  basePath: '',
  assetPrefix: './',
  
  // 禁用图片优化（静态导出不支持）
  images: {
    unoptimized: true,
  },
  
  // 确保生成的文件使用相对路径
  trailingSlash: true,
}

module.exports = nextConfig
