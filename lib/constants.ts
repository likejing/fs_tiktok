// TikTok 相关常量配置

// API 基础 URL（生产环境需要配置外部 API 服务器地址）
// 开发环境使用相对路径，生产环境使用完整 URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// TikTok授权URL
export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize?client_key=7519030880531447825&scope=biz.brand.insights%2Ccomment.list%2Cuser.info.basic%2Cuser.info.username%2Cuser.info.stats%2Cuser.info.profile%2Cuser.account.type%2Cuser.insights%2Cvideo.list%2Cvideo.insights%2Ccomment.list.manage%2Cvideo.publish%2Cvideo.upload%2Cbiz.spark.auth%2Cdiscovery.search.words%2Cbiz.ads.recommend%2Cbiz.creator.info%2Cbiz.creator.insights%2Ctto.campaign.link&response_type=code&redirect_uri=https%3A%2F%2Fltexpress.huokechuangxin.cn%2FgetOpenTkToken';

// TikTok用户信息接口（通过API代理，避免CORS问题）
export const TIKTOK_USER_INFO_API = `${API_BASE_URL}/api/getTkUserInfo`;

// TikTok视频列表接口（通过API代理，避免CORS问题）
export const TIKTOK_VIDEO_LIST_API = `${API_BASE_URL}/api/getTkVideoList`;

// TikTok刷新Token接口（通过API代理）
export const TIKTOK_REFRESH_TOKEN_API = `${API_BASE_URL}/api/refreshTkToken`;

// TikTok发布状态接口（通过API代理）
export const TIKTOK_PUBLISH_STATUS_API = `${API_BASE_URL}/api/getPublishStatus`;

// Apimart Sora2 视频生成（通过API代理）
export const APIMART_VIDEO_GENERATE_API = `${API_BASE_URL}/api/generateApimart`;
// Apimart 任务状态查询（通过API代理）
export const APIMART_TASK_STATUS_API = `${API_BASE_URL}/api/getApimartTaskStatus`;

// TikHub - 根据分享链接获取视频数据（通过API代理）
export const TIKHUB_FETCH_ONE_VIDEO_API = `${API_BASE_URL}/api/fetchSocialVideo`;

// 上传到 OSS（通过API代理）
export const UPLOAD_TO_OSS_API = `${API_BASE_URL}/api/uploadToOSS`;

// 代理下载（通过API代理）
export const PROXY_DOWNLOAD_API = `${API_BASE_URL}/api/proxyDownload`;

// 发布视频（通过API代理）
export const PUBLISH_VIDEO_API = `${API_BASE_URL}/api/publishVideo`;

// TikTok 评论相关 API（通过API代理）
export const TIKTOK_COMMENT_LIST_API = `${API_BASE_URL}/api/getTkComments`;
export const TIKTOK_COMMENT_REPLY_LIST_API = `${API_BASE_URL}/api/getTkCommentReplies`;
export const TIKTOK_COMMENT_CREATE_API = `${API_BASE_URL}/api/createTkComment`;
export const TIKTOK_COMMENT_REPLY_CREATE_API = `${API_BASE_URL}/api/createTkCommentReply`;
export const TIKTOK_COMMENT_LIKE_API = `${API_BASE_URL}/api/likeTkComment`;
export const TIKTOK_COMMENT_HIDE_API = `${API_BASE_URL}/api/hideTkComment`;
export const TIKTOK_COMMENT_DELETE_API = `${API_BASE_URL}/api/deleteTkComment`;
