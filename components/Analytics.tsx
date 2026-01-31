'use client';

import Script from 'next/script';
import { isAnalyticsEnabled } from '../lib/analytics';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const BAIDU_TONGJI_ID = process.env.NEXT_PUBLIC_BAIDU_TONGJI_ID || '';

/**
 * 第三方监测脚本加载组件
 * 仅在配置了 GA 或 百度统计 ID 时加载，用于用户数、停留时长、行为分析
 */
export default function Analytics() {
  if (!isAnalyticsEnabled()) {
    return null;
  }

  return (
    <>
      {/* Google Analytics 4 */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
                send_page_view: false
              });
            `}
          </Script>
        </>
      )}

      {/* 百度统计 */}
      {BAIDU_TONGJI_ID && (
        <Script
          src={`https://hm.baidu.com/hm.js?${BAIDU_TONGJI_ID}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
