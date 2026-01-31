/**
 * 网站监测工具 - 接入 Google Analytics 4 与百度统计
 * 用于查看用户数、停留时长、用户行为，便于后续优化
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    _hmt?: any[];
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const BAIDU_TONGJI_ID = process.env.NEXT_PUBLIC_BAIDU_TONGJI_ID || '';

export const isAnalyticsEnabled = (): boolean => !!(GA_MEASUREMENT_ID || BAIDU_TONGJI_ID);

/**
 * 发送页面浏览（GA4 会自动记录停留时长等）
 */
export function trackPageView(path: string, title?: string): void {
  if (GA_MEASUREMENT_ID && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document?.title || path,
    });
  }
  if (BAIDU_TONGJI_ID && typeof window !== 'undefined' && window._hmt) {
    window._hmt.push(['_trackPageview', path]);
  }
}

/**
 * 发送自定义事件（用于分析用户行为）
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (GA_MEASUREMENT_ID && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
  if (BAIDU_TONGJI_ID && typeof window !== 'undefined' && window._hmt) {
    // 百度统计自定义事件
    window._hmt.push(['_trackEvent', eventName, JSON.stringify(params || {})]);
  }
}

/**
 * 预定义事件名 - 便于统一分析
 */
export const AnalyticsEvents = {
  /** 用户切换功能 Tab */
  TAB_SWITCH: 'tab_switch',
  /** 用户执行某功能（如批量生成、发布等） */
  ACTION_CLICK: 'action_click',
  /** 表单提交 */
  FORM_SUBMIT: 'form_submit',
  /** 错误发生 */
  ERROR: 'error',
} as const;
