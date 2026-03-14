import { query, isBackupEnabled } from './db';

/**
 * 数据同步工具 - 用于将飞书多维表格数据同步到 MySQL
 */

/**
 * 同步账号数据
 */
export async function syncAccount(data: {
  recordId: string;
  openId: string;
  username?: string;
  displayName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresTime?: number;
  profileImage?: string;
  followersCount?: number;
  totalLikes?: number;
  videosCount?: number;
  followingCount?: number;
}): Promise<void> {
  if (!isBackupEnabled()) return;

  try {
    const sql = `
      INSERT INTO accounts (
        record_id, open_id, username, display_name, access_token, refresh_token,
        token_expires_time, profile_image, followers_count, total_likes,
        videos_count, following_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        open_id = VALUES(open_id),
        username = VALUES(username),
        display_name = VALUES(display_name),
        access_token = VALUES(access_token),
        refresh_token = VALUES(refresh_token),
        token_expires_time = VALUES(token_expires_time),
        profile_image = VALUES(profile_image),
        followers_count = VALUES(followers_count),
        total_likes = VALUES(total_likes),
        videos_count = VALUES(videos_count),
        following_count = VALUES(following_count),
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(sql, [
      data.recordId,
      data.openId,
      data.username || null,
      data.displayName || null,
      data.accessToken || null,
      data.refreshToken || null,
      data.tokenExpiresTime || null,
      data.profileImage || null,
      data.followersCount || null,
      data.totalLikes || null,
      data.videosCount || null,
      data.followingCount || null,
    ]);

    console.log(`✅ Synced account: ${data.openId}`);
  } catch (error) {
    console.error('❌ Failed to sync account:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 同步视频数据
 */
export async function syncVideo(data: {
  recordId: string;
  videoId: string;
  openId?: string;
  title?: string;
  caption?: string;
  shareUrl?: string;
  embedLink?: string;
  coverImageUrl?: string;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTime?: number;
}): Promise<void> {
  if (!isBackupEnabled()) return;

  try {
    const sql = `
      INSERT INTO videos (
        record_id, video_id, open_id, title, caption, share_url, embed_link,
        cover_image_url, duration, view_count, like_count, comment_count,
        share_count, create_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        video_id = VALUES(video_id),
        open_id = VALUES(open_id),
        title = VALUES(title),
        caption = VALUES(caption),
        share_url = VALUES(share_url),
        embed_link = VALUES(embed_link),
        cover_image_url = VALUES(cover_image_url),
        duration = VALUES(duration),
        view_count = VALUES(view_count),
        like_count = VALUES(like_count),
        comment_count = VALUES(comment_count),
        share_count = VALUES(share_count),
        create_time = VALUES(create_time),
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(sql, [
      data.recordId,
      data.videoId,
      data.openId || null,
      data.title || null,
      data.caption || null,
      data.shareUrl || null,
      data.embedLink || null,
      data.coverImageUrl || null,
      data.duration || null,
      data.viewCount || null,
      data.likeCount || null,
      data.commentCount || null,
      data.shareCount || null,
      data.createTime || null,
    ]);

    console.log(`✅ Synced video: ${data.videoId}`);
  } catch (error) {
    console.error('❌ Failed to sync video:', error);
  }
}

/**
 * 同步素材数据
 */
export async function syncMaterial(data: {
  recordId: string;
  caption?: string;
  videoUrl?: string;
  customThumbnailUrl?: string;
  publishStatus?: string;
  publishTime?: number;
  publishAccount?: string;
  shareId?: string;
  postIds?: string;
  tiktokVideoUrl?: string;
  isBrandOrganic?: boolean;
  isBrandedContent?: boolean;
  isAiGenerated?: boolean;
}): Promise<void> {
  if (!isBackupEnabled()) return;

  try {
    const sql = `
      INSERT INTO materials (
        record_id, caption, video_url, custom_thumbnail_url, publish_status,
        publish_time, publish_account, share_id, post_ids, tiktok_video_url,
        is_brand_organic, is_branded_content, is_ai_generated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        caption = VALUES(caption),
        video_url = VALUES(video_url),
        custom_thumbnail_url = VALUES(custom_thumbnail_url),
        publish_status = VALUES(publish_status),
        publish_time = VALUES(publish_time),
        publish_account = VALUES(publish_account),
        share_id = VALUES(share_id),
        post_ids = VALUES(post_ids),
        tiktok_video_url = VALUES(tiktok_video_url),
        is_brand_organic = VALUES(is_brand_organic),
        is_branded_content = VALUES(is_branded_content),
        is_ai_generated = VALUES(is_ai_generated),
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(sql, [
      data.recordId,
      data.caption || null,
      data.videoUrl || null,
      data.customThumbnailUrl || null,
      data.publishStatus || null,
      data.publishTime || null,
      data.publishAccount || null,
      data.shareId || null,
      data.postIds || null,
      data.tiktokVideoUrl || null,
      data.isBrandOrganic || null,
      data.isBrandedContent || null,
      data.isAiGenerated || null,
    ]);

    console.log(`✅ Synced material: ${data.recordId}`);
  } catch (error) {
    console.error('❌ Failed to sync material:', error);
  }
}

/**
 * 同步AI素材数据
 */
export async function syncAIMaterial(data: {
  recordId: string;
  prompt?: string;
  videoModel?: string;
  orientation?: string;
  duration?: number;
  style?: string;
  resolution?: string;
  taskId?: string;
  taskStatus?: string;
  videoUrl?: string;
  shouldGenerate?: boolean;
}): Promise<void> {
  if (!isBackupEnabled()) return;

  try {
    const sql = `
      INSERT INTO ai_materials (
        record_id, prompt, video_model, orientation, duration, style,
        resolution, task_id, task_status, video_url, should_generate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        prompt = VALUES(prompt),
        video_model = VALUES(video_model),
        orientation = VALUES(orientation),
        duration = VALUES(duration),
        style = VALUES(style),
        resolution = VALUES(resolution),
        task_id = VALUES(task_id),
        task_status = VALUES(task_status),
        video_url = VALUES(video_url),
        should_generate = VALUES(should_generate),
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(sql, [
      data.recordId,
      data.prompt || null,
      data.videoModel || null,
      data.orientation || null,
      data.duration || null,
      data.style || null,
      data.resolution || null,
      data.taskId || null,
      data.taskStatus || null,
      data.videoUrl || null,
      data.shouldGenerate || null,
    ]);

    console.log(`✅ Synced AI material: ${data.recordId}`);
  } catch (error) {
    console.error('❌ Failed to sync AI material:', error);
  }
}

/**
 * 同步评论数据
 */
export async function syncComment(data: {
  commentId: string;
  videoId: string;
  openId?: string;
  text?: string;
  createTime?: number;
  likeCount?: number;
  replyCount?: number;
  status?: string;
}): Promise<void> {
  if (!isBackupEnabled()) return;

  try {
    const sql = `
      INSERT INTO comments (
        comment_id, video_id, open_id, text, create_time, like_count,
        reply_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        video_id = VALUES(video_id),
        open_id = VALUES(open_id),
        text = VALUES(text),
        create_time = VALUES(create_time),
        like_count = VALUES(like_count),
        reply_count = VALUES(reply_count),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(sql, [
      data.commentId,
      data.videoId,
      data.openId || null,
      data.text || null,
      data.createTime || null,
      data.likeCount || null,
      data.replyCount || null,
      data.status || null,
    ]);

    console.log(`✅ Synced comment: ${data.commentId}`);
  } catch (error) {
    console.error('❌ Failed to sync comment:', error);
  }
}

/**
 * 记录操作日志
 */
export async function logOperation(data: {
  tableName: string;
  recordId: string;
  operation: 'create' | 'update' | 'delete';
  dataBefore?: any;
  dataAfter?: any;
  apiEndpoint?: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<void> {
  if (!isBackupEnabled()) return;

  try {
    const sql = `
      INSERT INTO operation_logs (
        table_name, record_id, operation, data_before, data_after,
        api_endpoint, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(sql, [
      data.tableName,
      data.recordId,
      data.operation,
      data.dataBefore ? JSON.stringify(data.dataBefore) : null,
      data.dataAfter ? JSON.stringify(data.dataAfter) : null,
      data.apiEndpoint || null,
      data.userAgent || null,
      data.ipAddress || null,
    ]);

    console.log(`✅ Logged operation: ${data.operation} on ${data.tableName}`);
  } catch (error) {
    console.error('❌ Failed to log operation:', error);
  }
}
