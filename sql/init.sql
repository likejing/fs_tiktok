-- TikTok 运营助手数据备份数据库
-- 创建数据库
CREATE DATABASE IF NOT EXISTS fs_tiktok_backup DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE fs_tiktok_backup;

-- 1. 账号表
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id VARCHAR(100) UNIQUE NOT NULL COMMENT '飞书记录ID',
  open_id VARCHAR(200) NOT NULL COMMENT 'TikTok open_id',
  username VARCHAR(200) COMMENT '用户名',
  display_name VARCHAR(200) COMMENT '账号展示名',
  access_token TEXT COMMENT '访问令牌',
  refresh_token TEXT COMMENT '刷新令牌',
  token_expires_time BIGINT COMMENT 'Token失效时间(毫秒时间戳)',
  profile_image TEXT COMMENT '头像链接',
  followers_count INT COMMENT '粉丝数',
  total_likes BIGINT COMMENT '获赞数',
  videos_count INT COMMENT '视频数',
  following_count INT COMMENT '关注数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_open_id (open_id),
  INDEX idx_record_id (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TikTok账号信息备份表';

-- 2. 视频列表
CREATE TABLE IF NOT EXISTS videos (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id VARCHAR(100) UNIQUE NOT NULL COMMENT '飞书记录ID',
  video_id VARCHAR(100) NOT NULL COMMENT 'TikTok视频ID',
  open_id VARCHAR(200) COMMENT '账号open_id',
  title TEXT COMMENT '视频标题',
  caption TEXT COMMENT '视频描述',
  share_url TEXT COMMENT '分享链接',
  embed_link TEXT COMMENT '嵌入链接',
  cover_image_url TEXT COMMENT '封面图链接',
  duration INT COMMENT '视频时长(秒)',
  view_count BIGINT COMMENT '播放量',
  like_count BIGINT COMMENT '点赞数',
  comment_count INT COMMENT '评论数',
  share_count INT COMMENT '分享数',
  create_time BIGINT COMMENT '发布时间(Unix时间戳)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_video_id (video_id),
  INDEX idx_open_id (open_id),
  INDEX idx_record_id (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='TikTok视频列表备份表';

-- 3. 素材库
CREATE TABLE IF NOT EXISTS materials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id VARCHAR(100) UNIQUE NOT NULL COMMENT '飞书记录ID',
  caption TEXT COMMENT '标题/描述',
  video_url TEXT COMMENT '视频链接',
  custom_thumbnail_url TEXT COMMENT '封面链接',
  publish_status VARCHAR(50) COMMENT '发布状态',
  publish_time BIGINT COMMENT '发布时间(毫秒时间戳)',
  publish_account VARCHAR(200) COMMENT '发布账号open_id',
  share_id VARCHAR(100) COMMENT 'TikTok分享ID',
  post_ids TEXT COMMENT 'TikTok帖子ID列表',
  tiktok_video_url TEXT COMMENT 'TikTok视频链接',
  is_brand_organic BOOLEAN COMMENT '是否品牌有机内容',
  is_branded_content BOOLEAN COMMENT '是否品牌内容',
  is_ai_generated BOOLEAN COMMENT '是否AI生成',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_record_id (record_id),
  INDEX idx_publish_account (publish_account),
  INDEX idx_publish_status (publish_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='素材库备份表';

-- 4. AI素材生成
CREATE TABLE IF NOT EXISTS ai_materials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id VARCHAR(100) UNIQUE NOT NULL COMMENT '飞书记录ID',
  prompt TEXT COMMENT '文本提示词',
  video_model VARCHAR(50) COMMENT '视频引擎(sora/veo)',
  orientation VARCHAR(20) COMMENT '横竖屏',
  duration INT COMMENT '生成时长(秒)',
  style VARCHAR(50) COMMENT '视频风格',
  resolution VARCHAR(20) COMMENT '视频分辨率',
  task_id VARCHAR(200) COMMENT '任务ID',
  task_status VARCHAR(50) COMMENT '生成状态',
  video_url TEXT COMMENT '生成的视频URL',
  should_generate BOOLEAN COMMENT '是否生成',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_record_id (record_id),
  INDEX idx_task_id (task_id),
  INDEX idx_task_status (task_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI素材生成备份表';

-- 5. 评论记录
CREATE TABLE IF NOT EXISTS comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  comment_id VARCHAR(100) UNIQUE NOT NULL COMMENT 'TikTok评论ID',
  video_id VARCHAR(100) NOT NULL COMMENT '视频ID',
  open_id VARCHAR(200) COMMENT '账号open_id',
  text TEXT COMMENT '评论内容',
  create_time BIGINT COMMENT '评论时间(Unix时间戳)',
  like_count INT COMMENT '点赞数',
  reply_count INT COMMENT '回复数',
  status VARCHAR(50) COMMENT '评论状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comment_id (comment_id),
  INDEX idx_video_id (video_id),
  INDEX idx_open_id (open_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论记录备份表';

-- 6. 操作日志
CREATE TABLE IF NOT EXISTS operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(100) NOT NULL COMMENT '表名',
  record_id VARCHAR(100) NOT NULL COMMENT '记录ID',
  operation VARCHAR(50) NOT NULL COMMENT '操作类型(create/update/delete)',
  data_before JSON COMMENT '操作前数据',
  data_after JSON COMMENT '操作后数据',
  api_endpoint VARCHAR(200) COMMENT 'API端点',
  user_agent TEXT COMMENT '用户代理',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_name (table_name),
  INDEX idx_record_id (record_id),
  INDEX idx_operation (operation),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- 创建完成
SELECT 'Database initialization completed!' AS message;
