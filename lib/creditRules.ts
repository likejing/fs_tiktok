/**
 * 积分定价规则（与 docs/积分定价规则.md 第 5 节一致）
 * 前后端共用，修改时请同步文档。
 */

/** 新用户首次初始化赠送积分 */
export const NEW_USER_CREDITS = 10;

const DEFAULT_PREVIEW_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * 生图单次消耗（按模型 + 分辨率档）
 */
export function getImageGenerationCredits(
  model: string | null | undefined,
  resolution: string | null | undefined
): number {
  const m = (model || DEFAULT_PREVIEW_IMAGE_MODEL).toLowerCase();
  const r = (resolution || '1K').toString().toUpperCase();
  const is4K = r.includes('4');

  // official 模型名含 official（如 gemini-3-pro-image-preview-official）
  if (m.includes('official')) {
    return is4K ? 20 : 10;
  }
  // preview 及其它默认按 preview 档
  return is4K ? 10 : 5;
}

/**
 * 视频单次消耗（按模型 + 清晰度；Sora 等非 Veo 按 fast 非 4K 档计价）
 */
export function getVideoGenerationCredits(
  model: string | null | undefined,
  resolution: string | null | undefined
): number {
  const m = (model || '').toLowerCase();
  const r = (resolution || '720p').toString().toLowerCase();
  const is4k = r.includes('4k');

  if (m.includes('veo3.1-quality') || (m.includes('veo') && m.includes('quality') && !m.includes('fast'))) {
    return is4k ? 200 : 60;
  }
  if (m.includes('veo3.1-fast') || (m.includes('veo3.1') && m.includes('fast'))) {
    return is4k ? 30 : 10;
  }
  // sora-2-pro 等：与历史「10 分」及 fast 非 4K 档对齐
  return 10;
}
