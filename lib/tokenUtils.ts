import { TIKTOK_REFRESH_TOKEN_API } from './constants';
import { getFieldStringValue } from './fieldUtils';

/**
 * Token 刷新结果
 */
export interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * 账号信息（包含 Token）
 */
export interface AccountInfo {
  recordId: string;
  openId: string;
  accessToken: string;
}

/**
 * 刷新 TikTok Access Token
 * @param refreshTokenValue - refresh_token 值
 * @returns 新的 token 数据
 */
export async function refreshTikTokToken(refreshTokenValue: string): Promise<TokenRefreshResult> {
  try {
    console.log(`正在刷新 TikTok Token...`);
    const response = await fetch(TIKTOK_REFRESH_TOKEN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshTokenValue
      })
    });

    const result = await response.json();

    if (result.code === 0 && result.data) {
      console.log(`✅ Token 刷新成功`);
      return result.data;
    } else {
      throw new Error(result.error || result.message || '刷新 Token 失败');
    }
  } catch (error: any) {
    console.error('刷新 Token 失败:', error);
    throw error;
  }
}

/**
 * 获取账号信息并自动维护 Token（检查过期并刷新）
 * @param accountTable - 账号表对象
 * @param accessTokenField - access_token 字段
 * @param openIdField - open_id 字段
 * @param openId - 要查找的 open_id 值
 * @param refreshTokenField - refresh_token 字段（可选）
 * @param tokenExpiresTimeField - token 失效时间字段（可选）
 * @returns 账号信息（包含有效的 access_token）
 */
export async function getAccountInfoWithTokenRefresh(
  accountTable: any,
  accessTokenField: any,
  openIdField: any,
  openId: string,
  refreshTokenField?: any,
  tokenExpiresTimeField?: any
): Promise<AccountInfo | null> {
  try {
    console.log(`查找账号信息 - open_id: ${openId}`);

    // 获取所有账号记录
    const records = await accountTable.getRecords({ pageSize: 5000 });
    console.log(`账号列表中共有 ${records.records.length} 条记录`);

    // 查找匹配的 open_id
    for (const record of records.records) {
      const recordOpenId = await getFieldStringValue(accountTable, openIdField, record.recordId);
      const recordOpenIdStr = recordOpenId ? String(recordOpenId).trim() : '';
      const targetOpenIdStr = String(openId).trim();

      console.log(`检查记录 ${record.recordId}: open_id = "${recordOpenIdStr}" (目标: "${targetOpenIdStr}")`);

      if (recordOpenIdStr === targetOpenIdStr) {
        // 找到匹配的账号，获取 access_token
        let accessToken = await getFieldStringValue(accountTable, accessTokenField, record.recordId);
        let accessTokenStr = accessToken ? String(accessToken).trim() : '';

        console.log(`✅ 找到匹配账号 - recordId: ${record.recordId}, access_token: ${accessTokenStr ? accessTokenStr.substring(0, 30) + '...' : '(空)'}`);

        // 检查 Token 失效时间 - token 失效时间字段为数字类型（时间戳毫秒）
        if (tokenExpiresTimeField) {
          try {
            // 直接获取数字类型的时间戳
            const expiresFieldValue = await tokenExpiresTimeField.getValue(record.recordId);
            const expiresTimestamp = typeof expiresFieldValue === 'number' ? expiresFieldValue :
              (expiresFieldValue ? Number(expiresFieldValue) : 0);
            let shouldRefresh = false;
            const now = Date.now();

            if (expiresTimestamp > 0) {
              const timeUntilExpiry = expiresTimestamp - now;

              console.log(`Token 失效时间检查: ${new Date(expiresTimestamp).toLocaleString()}, 剩余时间: ${Math.round(timeUntilExpiry / 1000 / 60)}分钟`);

              // 如果 Token 已失效或将在 5 分钟内失效，尝试刷新
              if (timeUntilExpiry < 5 * 60 * 1000) { // 5 分钟缓冲时间
                shouldRefresh = true;
                console.log(`⚠️ Token 即将失效或已失效，准备刷新...`);
              }
            } else {
              // 没有记录失效时间，视为需要刷新一次，确保后续有正确的 token 失效时间
              shouldRefresh = true;
              console.log('⚠️ 账号记录中没有 token 失效时间，将尝试刷新 Token 并补全该字段');
            }

            if (shouldRefresh) {
              if (refreshTokenField) {
                const refreshTokenValue = await getFieldStringValue(accountTable, refreshTokenField, record.recordId);
                if (refreshTokenValue) {
                  try {
                    const newTokenData = await refreshTikTokToken(String(refreshTokenValue).trim());

                    // 更新账号列表中的 token 信息
                    const updateFields: Record<string, any> = {};
                    updateFields[accessTokenField.id] = newTokenData.access_token;

                    if (refreshTokenField && newTokenData.refresh_token) {
                      updateFields[refreshTokenField.id] = newTokenData.refresh_token;
                    }

                    // 计算新的失效时间（expires_in 是秒数）- 直接使用时间戳（毫秒）
                    if (tokenExpiresTimeField && newTokenData.expires_in) {
                      const newExpiresTimestamp = now + newTokenData.expires_in * 1000;
                      updateFields[tokenExpiresTimeField.id] = newExpiresTimestamp;
                      console.log(`新的 Token 失效时间: ${new Date(newExpiresTimestamp).toLocaleString()} (时间戳: ${newExpiresTimestamp})`);
                    }

                    // 更新记录
                    await accountTable.setRecord(record.recordId, { fields: updateFields });
                    console.log(`✅ 已更新账号列表中的 Token 信息`);

                    // 使用新的 access_token
                    accessTokenStr = newTokenData.access_token;
                  } catch (refreshError: any) {
                    console.error(`❌ Token 刷新失败:`, refreshError);
                    console.warn(`Token 刷新失败: ${refreshError.message || '未知错误'}，将使用现有 Token`);
                  }
                } else {
                  console.warn(`⚠️ 未找到 refresh_token，无法刷新 Token`);
                }
              } else {
                console.warn(`⚠️ 账号列表中未找到 refresh_token 字段，无法自动刷新 Token`);
              }
            }
          } catch (e) {
            console.warn(`检查 Token 失效时间失败:`, e);
          }
        }

        if (!accessTokenStr) {
          console.warn(`⚠️ 账号 ${record.recordId} 的 access_token 为空`);
        } else if (accessTokenStr.length < 10) {
          console.warn(`⚠️ 账号 ${record.recordId} 的 access_token 格式可能不正确 (长度: ${accessTokenStr.length})`);
        }

        return {
          recordId: record.recordId,
          openId: openId,
          accessToken: accessTokenStr
        };
      }
    }

    console.warn(`❌ 未找到匹配的账号 - open_id: ${openId}`);
    return null;
  } catch (e) {
    console.error('获取账号信息失败:', e);
    return null;
  }
}

/**
 * 简化版：通过 recordId 直接获取账号的 access_token 并自动维护
 * @param accountTable - 账号表对象
 * @param recordId - 账号记录 ID
 * @returns access_token（已刷新如果需要）
 */
export async function getAccessTokenByRecordId(
  accountTable: any,
  recordId: string
): Promise<string | null> {
  try {
    const fieldMetaList = await accountTable.getFieldMetaList();

    // 查找必要字段
    const accessTokenField = fieldMetaList.find((f: any) => f.name === 'access_token' || f.name === '访问令牌');
    const refreshTokenField = fieldMetaList.find((f: any) => f.name === 'refresh_token' || f.name === '刷新令牌');
    const tokenExpiresTimeField = fieldMetaList.find((f: any) =>
      f.name === 'token失效时间' || f.name === 'token_expires_time' || f.name === 'expires_time'
    );

    if (!accessTokenField) {
      console.error('账号表缺少 access_token 字段');
      return null;
    }

    // 获取 access_token
    let accessToken = await getFieldStringValue(accountTable, accessTokenField, recordId);
    let accessTokenStr = accessToken ? String(accessToken).trim() : '';

    // 检查 Token 失效时间
    if (tokenExpiresTimeField) {
      try {
        const expiresFieldValue = await tokenExpiresTimeField.getValue(recordId);
        const expiresTimestamp = typeof expiresFieldValue === 'number' ? expiresFieldValue :
          (expiresFieldValue ? Number(expiresFieldValue) : 0);
        const now = Date.now();

        let shouldRefresh = false;

        if (expiresTimestamp > 0) {
          const timeUntilExpiry = expiresTimestamp - now;
          console.log(`Token 失效时间检查: ${new Date(expiresTimestamp).toLocaleString()}, 剩余时间: ${Math.round(timeUntilExpiry / 1000 / 60)}分钟`);

          if (timeUntilExpiry < 5 * 60 * 1000) {
            shouldRefresh = true;
            console.log(`⚠️ Token 即将失效或已失效，准备刷新...`);
          }
        } else {
          shouldRefresh = true;
          console.log('⚠️ 账号记录中没有 token 失效时间，将尝试刷新 Token');
        }

        if (shouldRefresh && refreshTokenField) {
          const refreshTokenValue = await getFieldStringValue(accountTable, refreshTokenField, recordId);
          if (refreshTokenValue) {
            try {
              const newTokenData = await refreshTikTokToken(String(refreshTokenValue).trim());

              // 更新账号列表中的 token 信息
              const updateFields: Record<string, any> = {};
              updateFields[accessTokenField.id] = newTokenData.access_token;

              if (refreshTokenField && newTokenData.refresh_token) {
                updateFields[refreshTokenField.id] = newTokenData.refresh_token;
              }

              if (tokenExpiresTimeField && newTokenData.expires_in) {
                const newExpiresTimestamp = now + newTokenData.expires_in * 1000;
                updateFields[tokenExpiresTimeField.id] = newExpiresTimestamp;
                console.log(`新的 Token 失效时间: ${new Date(newExpiresTimestamp).toLocaleString()}`);
              }

              await accountTable.setRecord(recordId, { fields: updateFields });
              console.log(`✅ 已更新账号 Token 信息`);

              accessTokenStr = newTokenData.access_token;
            } catch (refreshError: any) {
              console.error(`❌ Token 刷新失败:`, refreshError);
              console.warn(`Token 刷新失败，将使用现有 Token`);
            }
          }
        }
      } catch (e) {
        console.warn(`检查 Token 失效时间失败:`, e);
      }
    }

    return accessTokenStr || null;
  } catch (e) {
    console.error('获取 access_token 失败:', e);
    return null;
  }
}
