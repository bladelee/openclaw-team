# OpenClaw 多用户 API Token 管理与性能优化

## 目录

1. [独立 API Token 实现](#1-独立-api-token-实现)
2. [Token 消耗量统计](#2-token-消耗量统计)
3. [Gateway 性能分析](#3-gateway-性能分析)
4. [水平扩展方案](#4-水平扩展方案)
5. [生产环境最佳实践](#5-生产环境最佳实践)

---

## 1. 独立 API Token 实现

### 方案概述

为每个用户分配独立的 LLM API Token，实现：
- ✅ 成本追踪
- ✅ 配额管理
- ✅ 故障隔离
- ✅ 独立限流

### OpenClaw Auth Profile 机制

OpenClaw 使用 **Auth Profile** 来管理 API Token：

```
~/.openclaw/profiles/
├── default-anthropic.json
├── user-alice-anthropic.json
└── user-bob-anthropic.json
```

**Profile 文件格式**：

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-xxx...",
  "createdAt": 1736123456789,
  "userId": "user-alice"
}
```

### 实现方案

#### 方案 A：主密钥派生子密钥（推荐）⭐⭐⭐⭐⭐

**原理**：使用一个主 API Key，通过前缀/标签来区分不同用户。

**优点**：
- ✅ 简化管理（只有一个主密钥）
- ✅ LLM 提供商支持子密钥标签
- ✅ 易于追踪成本

**缺点**：
- ⚠️ 取决于 LLM 提供商的支持

**实施**：

```typescript
// src/services/api-key-manager.ts

import crypto from 'crypto';

export class ApiKeyManager {
  /**
   * 为用户生成子密钥标识
   * 注意：这不会生成新的 API Key，而是用于追踪
   */
  generateUserKeyIdentifier(userId: string): string {
    // 格式：sk-ant-user-{userId}-{random}
    return `sk-ant-user-${userId}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 在 LLM API 调用时添加用户标识
   */
  async getUserApiKey(userId: string): Promise<{
    identifier: string;
    actualKey: string;
  }> {
    // 返回用户标识和实际的主密钥
    const identifier = this.generateUserKeyIdentifier(userId);
    const actualKey = process.env.ANTHROPIC_API_KEY; // 从环境变量读取

    return { identifier, actualKey };
  }

  /**
   * 解析 API 响应中的成本数据
   */
  parseCostData(userId: string, response: any, tokensUsed: number): {
    cost: number;
    provider: string;
    model: string;
  } {
    // Claude 定价（2025年价格）
    const pricing = {
      'claude-sonnet-4-5-20250514': {
        input: 3.0 / 1_000_000,  // $3 per million tokens
        output: 15.0 / 1_000_000,
      },
      'claude-3-7-sonnet-20250219': {
        input: 0.6 / 1_000_000,
        output: 3.0 / 1_000_000,
      },
    };

    const modelInfo = response.model || 'claude-sonnet-4-5-20250514';
    const pricingInfo = pricing[modelInfo] || pricing['claude-sonnet-4-5-20250514'];

    const inputCost = tokensUsed * pricingInfo.input;
    const outputCost = tokensUsed * pricingInfo.output;
    const totalCost = inputCost + outputCost;

    return {
      cost: totalCost,
      provider: 'anthropic',
      model: modelInfo,
    };
  }
}
```

#### 方案 B：独立 API Key（完全隔离）⭐⭐⭐⭐

**原理**：为每个用户创建真实的独立 API Key。

**优点**：
- ✅ 完全隔离
- ✅ 可以设置不同的配额
- ✅ 故障隔离

**缺点**：
- ⚠️ 管理复杂度高
- ⚠️ 成本可能更高

**实施**：

```typescript
// src/services/user-api-keys.ts

import Anthropic from '@anthropic-ai/sdk';

export class UserApiKeyManager {
  /**
   * 为用户创建独立的 API Key
   */
  async createUserApiKey(userId: string, provider: 'anthropic' | 'openai' = 'anthropic'): Promise<{
    profileId: string;
    apiKey: string;
  }> {
    const profileId = `user-${userId}-${provider}`;

    if (provider === 'anthropic') {
      // 使用 Anthropic Admin API 创建密钥
      const apiKey = await this.createAnthropicApiKey(userId, profileId);
      return { profileId, apiKey };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * 使用 Anthropic API 创建密钥
   */
  private async createAnthropicApiKey(userId: string, profileId: string): Promise<string> {
    // 方式 1：手动创建密钥（如果数量少）
    // 在 Anthropic Console 中手动创建，然后存储到数据库

    // 方式 2：使用 Anthropic Admin API（需要企业账户）
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_ADMIN_API_KEY,
    });

    try {
      // 调用 Admin API 创建密钥（注意：这是假设的功能）
      const key = await anthropic.apiKeys.create({
        name: `OpenClaw User: ${userId}`,
        profile: 'default',
      });

      return key.key;
    } catch (error) {
      console.error(`Failed to create API key for user ${userId}:`, error);
      throw new Error('Failed to create user API key');
    }
  }

  /**
   * 为用户配置 auth profile
   */
  async configureUserProfile(
    userId: string,
    profileId: string,
    apiKey: string
  ): Promise<void> {
    const profileDir = '/data/openclaw-profiles';
    await fs.mkdir(profileDir, { recursive: true });

    const profileFile = path.join(profileDir, `${profileId}.json`);
    await fs.writeFile(profileFile, JSON.stringify({
      provider: 'anthropic',
      apiKey,
      userId,
      createdAt: Date.now(),
      lastUsedAt: null,
    }, null, 2));

    console.log(`[ApiKeyManager] Configured profile ${profileId} for user ${userId}`);
  }

  /**
   * 获取用户的 auth profile
   */
  async getUserProfile(userId: string): Promise<{
    profileId: string;
    apiKey: string;
  }> {
    const profileId = `user-${userId}-anthropic`;
    const profileFile = `/data/openclaw-profiles/${profileId}.json`;

    try {
      const content = await fs.readFile(profileFile, 'utf-8');
      const profile = JSON.parse(content);

      // 更新最后使用时间
      profile.lastUsedAt = Date.now();
      await fs.writeFile(profileFile, JSON.stringify(profile, null, 2));

      return {
        profileId,
        apiKey: profile.apiKey,
      };
    } catch {
      // 配置不存在，使用默认密钥
      const defaultKey = process.env.ANTHROPIC_API_KEY;
      if (!defaultKey) {
        throw new Error('No default API key configured');
      }

      // 创建用户配置
      await this.configureUserProfile(userId, profileId, defaultKey);

      return {
        profileId,
        apiKey: defaultKey,
      };
    }
  }

  /**
   * 撤销用户的 API Key
   */
  async revokeUserApiKey(userId: string): Promise<void> {
    const profileId = `user-${userId}-anthropic`;
    const profileFile = `/data/openclaw-profiles/${profileId}.json`;

    try {
      const content = await fs.readFile(profileFile, 'utf-8');
      const profile = JSON.parse(content);

      // 标记为已撤销
      profile.revokedAt = Date.now();
      profile.apiKey = 'REVOKED';

      await fs.writeFile(profileFile, JSON.stringify(profile, null, 2));

      console.log(`[ApiKeyManager] Revoked API key for user ${userId}`);
    } catch {
      // 配置不存在，无需撤销
    }
  }
}
```

### Gateway 配置

**方式 1：环境变量配置**

```yaml
# ~/.openclaw/config.yml

agents:
  defaults:
    model: claude-sonnet-4-5-20250514
    provider: anthropic

  # 可选：为特定用户配置不同的 API Key
  profiles:
    user-alice-anthropic:
      provider: anthropic
      apiKey: sk-ant-user-alice-xxx

    user-bob-anthropic:
      provider: anthropic
      apiKey: sk-ant-user-bob-yyy
```

**方式 2：动态加载（推荐）**

```typescript
// src/agents/model-auth.ts

import { getUserProfile } from '@/services/user-api-keys';

export async function resolveApiKeyForUser(userId: string): Promise<string> {
  try {
    // 尝试获取用户的专属 API Key
    const profile = await getUserProfile(userId);
    console.log(`[ModelAuth] Using user-specific API key for ${userId}: ${profile.profileId}`);
    return profile.apiKey;
  } catch (error) {
    // 回退到默认密钥
    console.warn(`[ModelAuth] Failed to get user API key for ${userId}, using default:`, error);
    return process.env.ANTHROPIC_API_KEY;
  }
}
```

### 客户端集成

```typescript
// src/openclaw/client.ts

export class OpenClawClient {
  /**
   * 设置用户的 API 配额
   */
  async setApiQuota(userId: string, quota: {
    maxTokensPerDay?: number;
    maxCostPerMonth?: number;
  }): Promise<void> {
    const oauthToken = await oauthClient.getAccessToken();

    await fetch('/api/openclaw/quota', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        quota,
      }),
    });
  }

  /**
   * 获取使用统计
   */
  async getUsageStats(userId: string): Promise<{
    tokensUsed: number;
    costIncurred: number;
    requestsCount: number;
    period: {
      start: string;
      end: string;
    };
  }> {
    const oauthToken = await oauthClient.getAccessToken();

    const response = await fetch('/api/openclaw/usage/stats', {
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });

    return await response.json();
  }
}
```

---

## 2. Token 消耗量统计

### 数据库设计

```sql
-- Token 使用记录表
CREATE TABLE token_usage_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_key VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  tokens_total INT DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  request_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_session_key (session_key),
  INDEX idx_timestamp (timestamp),
  INDEX idx_user_timestamp (user_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token使用记录';

-- 用户配额表
CREATE TABLE user_quotas (
  user_id VARCHAR(255) PRIMARY KEY,
  max_tokens_per_day BIGINT DEFAULT 100000 COMMENT '每日最大token数',
  max_cost_per_month DECIMAL(10, 2) DEFAULT 100.00 COMMENT '每月最大成本（美元）',
  current_day_tokens BIGINT DEFAULT 0 COMMENT '今日已用token',
  current_month_cost DECIMAL(10, 2) DEFAULT 0.00 COMMENT '本月已用成本',
  day_reset_date DATE COMMENT '日重置日期',
  month_reset_date DATE COMMENT '月重置日期',
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_day_reset (day_reset_date),
  INDEX idx_month_reset (month_reset_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户配额';
```

### 使用统计服务

```typescript
// src/services/usage-tracking.ts

import { db } from '@/db';

export interface UsageRecord {
  userId: string;
  sessionKey: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
  requestId: string;
}

export class UsageTrackingService {
  /**
   * 记录 Token 使用
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    const {
      userId,
      sessionKey,
      provider,
      model,
      tokensInput,
      tokensOutput,
      tokensTotal,
      costUsd,
      requestId,
    } = record;

    // 1. 插入使用记录
    await db.query(`
      INSERT INTO token_usage_logs
      (user_id, session_key, provider, model, tokens_input, tokens_output, tokens_total, cost_usd, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, sessionKey, provider, model, tokensInput, tokensOutput, tokensTotal, costUsd, requestId]);

    // 2. 更新配额使用情况
    await this.updateQuotaUsage(userId, tokensTotal, costUsd);

    // 3. 检查是否超出配额
    await this.checkQuotaExceeded(userId);

    console.log(`[UsageTracking] Recorded usage for user ${userId}: ${tokensTotal} tokens, $${costUsd.toFixed(6)}`);
  }

  /**
   * 更新配额使用情况
   */
  private async updateQuotaUsage(userId: string, tokensUsed: number, costIncurred: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    await db.query(`
      INSERT INTO user_quotas (user_id, current_day_tokens, day_reset_date, current_month_cost, month_reset_date)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        current_day_tokens = CASE
          WHEN day_reset_date = ? THEN current_day_tokens + ?
          ELSE ?
        END,
        current_month_cost = CASE
          WHEN month_reset_date = ? THEN current_month_cost + ?
          ELSE ?
        END
    `, [userId, tokensUsed, today, costIncurred, thisMonth,
        today, tokensUsed, tokensUsed,
        thisMonth, costIncurred, costIncurred]);
  }

  /**
   * 检查是否超出配额
   */
  private async checkQuotaExceeded(userId: string): Promise<void> {
    const quota = await db.query(`
      SELECT max_tokens_per_day, max_cost_per_month, current_day_tokens, current_month_cost
      FROM user_quotas
      WHERE user_id = ?
    `, [userId]);

    if (quota.length === 0) {
      return; // 没有配置配额
    }

    const { maxTokensPerDay, maxCostPerMonth, currentDayTokens, currentMonthCost } = quota[0];

    // 检查每日配额
    if (maxTokensPerDay && currentDayTokens > maxTokensPerDay) {
      throw new QuotaExceededError(
        'DAILY_TOKENS',
        `Daily token limit exceeded: ${currentDayTokens} / ${maxTokensPerDay}`
      );
    }

    // 检查每月配额
    if (maxCostPerMonth && currentMonthCost > maxCostPerMonth) {
      throw new QuotaExceededError(
        'MONTHLY_COST',
        `Monthly cost limit exceeded: $${currentMonthCost.toFixed(2)} / $${maxCostPerMonth.toFixed(2)}`
      );
    }
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(
    userId: string,
    period: 'today' | 'week' | 'month' | 'all'
  ): Promise<{
    tokensUsed: number;
    costIncurred: number;
    requestsCount: number;
    breakdown: {
      byModel: Record<string, { tokens: number; cost: number; requests: number }>;
      byDay: Array<{ date: string; tokens: number; cost: number }>;
    };
  }> {
    let dateFilter = '';
    const now = new Date();

    switch (period) {
      case 'today':
        dateFilter = `DATE(timestamp) = CURDATE()`;
        break;
      case 'week':
        dateFilter = `timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        break;
      case 'month':
        dateFilter = `timestamp >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;
        break;
      case 'all':
        dateFilter = '1=1';
        break;
    }

    // 总计统计
    const total = await db.query(`
      SELECT
        SUM(tokens_total) as tokensUsed,
        SUM(cost_usd) as costIncurred,
        COUNT(*) as requestsCount
      FROM token_usage_logs
      WHERE user_id = ? AND ${dateFilter}
    `, [userId]);

    // 按模型分组
    const byModel = await db.query(`
      SELECT
        model,
        SUM(tokens_total) as tokens,
        SUM(cost_usd) as cost,
        COUNT(*) as requests
      FROM token_usage_logs
      WHERE user_id = ? AND ${dateFilter}
      GROUP BY model
    `, [userId]);

    // 按日期分组
    const byDay = await db.query(`
      SELECT
        DATE(timestamp) as date,
        SUM(tokens_total) as tokens,
        SUM(cost_usd) as cost
      FROM token_usage_logs
      WHERE user_id = ? AND ${dateFilter}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `, [userId]);

    const breakdown = {
      byModel: {},
      byDay: byDay.map(row => ({
        date: row.date.toISOString().split('T')[0],
        tokens: row.tokens,
        cost: row.cost,
      })),
    };

    for (const row of byModel) {
      breakdown.byModel[row.model] = {
        tokens: row.tokens,
        cost: row.cost,
        requests: row.requests,
      };
    }

    return {
      tokensUsed: total[0]?.tokensUsed || 0,
      costIncurred: total[0]?.costIncurred || 0,
      requestsCount: total[0]?.requestsCount || 0,
      breakdown,
    };
  }

  /**
   * 重置用户配额（管理员功能）
   */
  async resetUserQuota(userId: string, type: 'daily' | 'monthly'): Promise<void> {
    if (type === 'daily') {
      await db.query(`
        UPDATE user_quotas
        SET current_day_tokens = 0, day_reset_date = CURDATE()
        WHERE user_id = ?
      `, [userId]);
    } else {
      await db.query(`
        UPDATE user_quotas
        SET current_month_cost = 0, month_reset_date = DATE_FORMAT(CURDATE(), '%Y-%m-01')
        WHERE user_id = ?
      `, [userId]);
    }
  }
}

class QuotaExceededError extends Error {
  constructor(
    public type: 'DAILY_TOKENS' | 'MONTHLY_COST',
    message: string
  ) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}
```

### Agent 集成

**修改 Agent 运行器以记录使用**：

```typescript
// src/agents/pi-embedded-runner/run.ts

import { UsageTrackingService } from '@/services/usage-tracking';

export async function runEmbeddedPiAgent(params: RunEmbeddedPiAgentParams) {
  // ... 现有代码 ...

  const usageTracker = new UsageTrackingService();
  const requestId = crypto.randomUUID();

  try {
    // 执行 Agent 运行
    const result = await runEmbeddedAttempt({
      ...params,
      requestId,  // 传递 requestId
    });

    // 记录 Token 使用
    if (result.usage) {
      await usageTracker.recordUsage({
        userId: extractUserIdFromSessionKey(params.sessionKey),
        sessionKey: params.sessionKey || 'unknown',
        provider: result.usage.provider,
        model: result.usage.model,
        tokensInput: result.usage.inputTokens || 0,
        tokensOutput: result.usage.outputTokens || 0,
        tokensTotal: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        costUsd: calculateCost(result.usage),
        requestId,
      });
    }

    return result;
  } catch (error) {
    // 处理 QuotaExceededError
    if (error instanceof QuotaExceededError) {
      // 返回用户友好的错误消息
      return {
        error: error.message,
        type: error.type,
        canContinue: false,
      };
    }
    throw error;
  }
}

function extractUserIdFromSessionKey(sessionKey: string | undefined): string {
  // sessionKey 格式: "user:{userId}"
  if (!sessionKey) {
    return 'unknown';
  }
  return sessionKey.replace(/^user:/, '');
}

function calculateCost(usage: any): number {
  // Claude 定价（2025年）
  const pricing = {
    'claude-sonnet-4-5-20250514': {
      input: 3.0 / 1_000_000,
      output: 15.0 / 1_000_000,
    },
  };

  const model = usage.model || 'claude-sonnet-4-5-20250514';
  const pricingInfo = pricing[model] || pricing['claude-sonnet-4-5-20250514'];

  const inputCost = (usage.inputTokens || 0) * pricingInfo.input;
  const outputCost = (usage.outputTokens || 0) * pricingInfo.output;

  return inputCost + outputCost;
}
```

### API 路由

```typescript
// src/routes/usage.ts

import express from 'express';
import { verifyOAuthToken } from '@/auth/oauth-validator';
import { UsageTrackingService } from '@/services/usage-tracking';

const router = express.Router();
const usageService = new UsageTrackingService();

/**
 * GET /api/openclaw/usage/stats
 * 获取用户使用统计
 */
router.get('/usage/stats', async (req, res) => {
  try {
    const user = await verifyOAuthToken(req.headers.authorization);
    const userId = user.userId;

    const period = (req.query.period as string) || 'month';

    const stats = await usageService.getUserUsageStats(userId, period);

    res.json(stats);
  } catch (error) {
    console.error('[API] Failed to get usage stats:', error);
    res.status(500).json({ error: error.message || 'Failed to get usage stats' });
  }
});

/**
 * POST /api/openclaw/quota
 * 设置用户配额
 */
router.post('/quota', async (req, res) => {
  try {
    const user = await verifyOAuthToken(req.headers.authorization);
    const userId = user.userId;

    const { maxTokensPerDay, maxCostPerMonth } = req.body;

    await db.query(`
      INSERT INTO user_quotas (user_id, max_tokens_per_day, max_cost_per_month)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        max_tokens_per_day = COALESCE(VALUES(max_tokens_per_day), max_tokens_per_day),
        max_cost_per_month = COALESCE(VALUES(max_cost_per_month), max_cost_per_month)
    `, [userId, maxTokensPerDay, maxCostPerMonth]);

    res.json({
      success: true,
      message: 'Quota updated successfully',
    });
  } catch (error) {
    console.error('[API] Failed to set quota:', error);
    res.status(500).json({ error: error.message || 'Failed to set quota' });
  }
});

/**
 * POST /api/openclaw/quota/reset
 * 重置配额（管理员）
 */
router.post('/quota/reset', async (req, res) => {
  try {
    // 验证管理员权限
    const user = await verifyOAuthToken(req.headers.authorization);
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    const { userId, type } = req.body;

    await usageService.resetUserQuota(userId, type);

    res.json({
      success: true,
      message: `Quota reset successful (${type})`,
    });
  } catch (error) {
    console.error('[API] Failed to reset quota:', error);
    res.status(500).json({ error: error.message || 'Failed to reset quota' });
  }
});

export default router;
```

---

## 3. Gateway 性能分析

### OpenClaw Gateway 架构分析

```
┌─────────────────────────────────────────────────────────────────┐
│                  Gateway 单进程架构                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │ │
│  │              Node.js 事件循环（单线程）                      │ │ │
│  │                                                          │ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │ WebSocket 连接管理（ws 库）                          │ │ │ │
│  │  │ - 处理所有客户端连接                                  │ │ │ │
│  │  │ - 每个连接是一个 WebSocket                            │ │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │                                                          │ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │ 消息处理队列（SessionLane + GlobalLane）            │ │ │ │
│  │  │ - 每个 sessionKey 有独立的队列                         │ │ │ │
│  │  │ - 全局队列用于并发控制                                │ │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │                                                          │ │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │ Agent 运行（pi-ai SDK）                               │ │ │ │
│  │  │ - 同步执行（阻塞事件循环）                            │ │ │ │
│  │  │ - 一次只处理一个请求                                  │ │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │ │
│  └────────────────────────────────────────────────────────────┘ │ │
└─────────────────────────────────────────────────────────────────┘

性能瓶颈：
1. ❌ 单线程事件循环
2. ❌ 同步 Agent 执行
3. ❌ WebSocket 连接数限制
4. ❌ 内存使用线性增长
```

### 性能测试数据

**理论分析**：

| 指标 | 估计值 | 说明 |
|------|--------|------|
| **WebSocket 连接数** | 1,000 - 5,000 | 取决于文件描述符限制 |
| **并发请求数** | 1（串行） | Agent 同步执行，一次一个 |
| **内存占用** | ~50MB/连接 | 包含会话状态 |
| **CPU 使用** | 100% / 核心 | Agent 运行时满载 |
| **请求延迟** | P50: 1s, P99: 5s | 取决于 LLM API 延迟 |

**实际测试建议**：

```bash
# 压力测试脚本
# scripts/stress-test-gateway.sh

#!/bin/bash

GATEWAY_URL="ws://localhost:18789"
PASSWORD="test-password"
CONCURRENT_USERS=100
REQUESTS_PER_USER=10

echo "Starting stress test..."
echo "Concurrent users: $CONCURRENT_USERS"
echo "Requests per user: $REQUESTS_PER_USER"

for i in $(seq 1 $CONCURRENT_USERS); do
  (
    for j in $(seq 1 $REQUESTS_PER_USER); do
      # 发送 chat.send 请求
      echo "User $i, Request $j"
      # 使用 websocat 或类似工具发送请求
    done
  ) &
done

wait
echo "Stress test completed!"
```

### 性能瓶颈分析

**瓶颈 1：单线程事件循环**

```
问题：Node.js 单线程无法利用多核 CPU
影响：CPU 密集型操作（Agent 执行）
解决：使用 Worker Threads 或集群
```

**瓶颈 2：同步 Agent 执行**

```
问题：pi-ai SDK 是同步的，阻塞事件循环
影响：并发用户必须排队等待
解决：异步化 Agent 执行
```

**瓶颈 3：内存占用**

```
问题：每个连接 ~50MB 内存
影响：1000 用户 = 50GB 内存
解决：连接池、会话清理
```

---

## 4. 水平扩展方案

### 方案 A：多实例负载均衡（推荐）⭐⭐⭐⭐⭐

#### 原理

启动多个 Gateway 实例，通过负载均衡器分发连接。

```
                    负载均衡器 (Nginx/HAProxy)
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
            ┌────────┐      ┌────────┐      ┌────────┐
            │Gateway │      │Gateway │      │Gateway │
            │Instance│      │Instance│      │Instance│
            │   #1   │      │   #2   │      │   #3   │
            │-User A │      │-User D │      │-User G │
            │-User B │      │-User E │      │-User H │
            │-User C │      │-User F │      │-User I │
            └────────┘      └────────┘      └────────┘
                │                │                │
            ~50MB/用户       ~50MB/用户       ~50MB/用户
```

#### Nginx 配置

```nginx
# /etc/nginx/conf.d/openclaw.conf

upstream openclaw_gateways {
    least_conn;  # 最少连接算法

    server 10.0.1.11:18789 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:18789 max_fails=3 fail_timeout=30s;
    server 10.0.1.13:18789 max_fails=3 fail_timeout=30s;
    server 10.0.1.14:18789 max_fails=3 fail_timeout=30s;
    server 10.0.1.15:18789 max_fails=3 fail_timeout=30s;
    server 10.0.1.16:18789 max_fails=3 fail_timeout=30s;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name openclaw.example.com;

    ssl_certificate /etc/letsencrypt/live/openclaw.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.example.com/privkey.pem;

    # WebSocket 升级
    location /ws {
        proxy_pass http://openclaw_gateways;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # 传递用户信息（可选）
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }

    # 健康检查
    location /health {
        proxy_pass http://openclaw_gateways/health;
        access_log off;
    }
}
```

#### 实施脚本

```bash
#!/bin/bash
# scripts/deploy-gateway-cluster.sh

GATEWAY_COUNT=6
BASE_PORT=18789
START_PORT=19000
HOST_BASE="10.0.1."

echo "Deploying $GATEWAY_COUNT Gateway instances..."

for i in $(seq 1 $GATEWAY_COUNT); do
  PORT=$((START_PORT + i - 1))
  CONTAINER_NAME="openclaw-gateway-${i}"

  echo "Starting Gateway instance $i on port $PORT..."

  docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:18789 \
    -v /data/openclaw-gateway-${i}:/data \
    -e OPENCLAW_GATEWAY_MODE=password \
    -e OPENCLAW_LOG_LEVEL=info \
    openclaw/gateway:latest

  # 等待启动
  sleep 5

  # 健康检查
  if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
    echo "✅ Gateway $i is healthy"
  else
    echo "❌ Gateway $i failed to start"
  fi
done

echo "All Gateway instances deployed!"
```

#### 优点

- ✅ 无限水平扩展
- ✅ 故障隔离（一个实例崩溃不影响其他）
- ✅ 易于部署和维护

#### 缺点

- ⚠️ 需要管理多个实例
- ⚠️ 需要负载均衡器

### 方案 B：Node.js 集群（单机多进程）⭐⭐⭐⭐

#### 原理

使用 Node.js 集群模式，在一台机器上运行多个 Gateway 进程。

```
单机多进程：
┌─────────────────────────────────────────────────────────────┐
│  Node.js Master 进程                                           │
│  ├─ Fork Worker 1 (Gateway #1)                                  │
│  │   ├─ 处理连接 1-166                                            │
│  └─ Fork Worker 2 (Gateway #2)                                  │
│      ├─ 处理连接 167-333                                          │
└─ Fork Worker 3 (Gateway #3)                                  │
      ├─ 处理连接 334-500                                          │
```

#### 实施

```typescript
// src/cluster/gateway-cluster.ts

import cluster from 'cluster';
import os from 'os';

export class GatewayCluster {
  private workers: Map<number, any> = new Map();

  start(workerCount?: number): void {
    const numCPUs = os.cpus().length;
    const workers = workerCount || numCPUs;

    console.log(`[Cluster] Starting Gateway cluster with ${workers} workers`);

    cluster.setupPrimary({
      exec: path.join(__dirname, '../../gateway-server.js'),
      args: process.argv.slice(2),
      silent: false,
    });

    cluster.on('fork', (worker) => {
      console.log(`[Cluster] Worker ${worker.process.pid} started`);
      this.workers.set(worker.id, worker);
    });

    cluster.on('exit', (worker, code, signal) => {
      console.log(`[Cluster] Worker ${worker.process.pid} exited (code: ${code}, signal: ${signal})`);
      this.workers.delete(worker.id);

      // 重启 Worker
      console.log('[Cluster] Restarting worker...');
      cluster.fork();
    });

    // 启动 Workers
    for (let i = 0; i < workers - 1; i++) {
      cluster.fork();
    }
  }

  stop(): void {
    console.log('[Cluster] Stopping all workers...');

    for (const [id, worker] of this.workers) {
      worker.kill('SIGTERM');
    }

    this.workers.clear();
  }

  getStatus(): {
    workers: number;
    pids: number[];
  } {
    return {
      workers: this.workers.size,
      pids: Array.from(this.workers.values()).map(w => w.process.pid),
    };
  }
}
```

**启动脚本**：

```typescript
// src/cli/cluster-gateway.ts

import { GatewayCluster } from '../cluster/gateway-cluster';

const cluster = new GatewayCluster();

// 启动集群
cluster.start();

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  cluster.stop();
  process.exit(0);
});
```

#### Docker Compose 配置

```yaml
version: '3.8'

services:
  openclaw-gateway-cluster:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_CLUSTER_MODE=true
      - OPENCLAW_CLUSTER_WORKERS=4
    volumes:
      - /data/openclaw-gateway:/data
    restart: unless-stopped
```

#### 优点

- ✅ 充分利用多核 CPU
- ✅ 相对简单部署
- ✅ 共享文件系统

#### 缺点

- ⚠️ 仍然有内存限制
- ⚠️ 故障隔离不如独立容器

### 方案 C：连接池 + 会话清理（优化）⭐⭐⭐

#### 原理

限制并发连接数，定期清理不活跃会话。

```typescript
// src/services/connection-pool.ts

export class ConnectionPool {
  private connections: Map<string, any> = new Map();
  private maxConnections: number = 1000;

  /**
   * 检查是否接受新连接
   */
  canAcceptConnection(): boolean {
    return this.connections.size < this.maxConnections;
  }

  /**
   * 添加连接
   */
  addConnection(connId: string, connection: any): void {
    this.connections.set(connId, connection);

    console.log(`[ConnectionPool] Active connections: ${this.connections.size}/${this.maxConnections}`);

    if (this.connections.size >= this.maxConnections * 0.9) {
      console.warn(`[ConnectionPool] Connection pool ${Math.floor((this.connections.size / this.maxConnections) * 100)}% full`);
    }
  }

  /**
   * 移除连接
   */
  removeConnection(connId: string): void {
    this.connections.delete(connId);
    console.log(`[ConnectionPool] Active connections: ${this.connections.size}/${this.maxConnections}`);
  }

  /**
   * 清理不活跃会话
   */
  async cleanupInactiveSessions(timeoutMs: number = 30 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [connId, conn] of this.connections) {
      const lastActivity = conn.lastActivity || 0;

      if (now - lastActivity > timeoutMs) {
        toRemove.push(connId);
      }
    }

    console.log(`[ConnectionPool] Cleaning up ${toRemove.length} inactive sessions...`);

    for (const connId of toRemove) {
      const conn = this.connections.get(connId);
      conn.close();
      this.removeConnection(connId);
    }

    if (toRemove.length > 0) {
      console.log(`[ConnectionPool] Cleaned ${toRemove.length} inactive sessions`);
    }
  }
}

// 定期清理
const pool = new ConnectionPool();
setInterval(() => {
  pool.cleanupInactiveSessions(30 * 60 * 1000); // 每 30 分钟
}, 5 * 60 * 1000); // 每 5 分钟检查
```

---

## 5. 生产环境最佳实践

### 推荐架构

```
┌─────────────────────────────────────────────────────────────────┐
│                  生产环境推荐架构                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  负载均衡层 (Nginx/HAProxy)                                   │ │ │
│  │  - SSL/TLS 终止                                               │ │ │
│  │  - WebSocket 升级                                               │ │ │
│  │  - 健康检查                                                   │ │ │
│  │  - 故障转移                                                   │ │ │
│  └───────────────────────────┬──────────────────────────────────┘ │ │
│                              │                                   │ │
│  ┌───────────────────────────┴──────────────────────────────────┐ │ │
│  │          Gateway 集群（3-5 个实例）                        │ │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │ │ │
│  │  │Gateway #1      │  │Gateway #2      │  │Gateway #3      │  │ │ │
│  │  │- 200 并发    │  │- 200 并发    │  │- 200 并发    │  │ │ │
│  │  │- 10GB 内存    │  │- 10GB 内存    │  │- 10GB 内存    │  │ │ │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  │ │ │
│  │  - 总容量: 600-1000 并发用户                              │ │ │
│  └──────────────────────────────────────────────────────────────┘ │ │
│                                                                  │ │
│  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │          数据库 + 缓存                                         │ │ │
│  │  ├─ PostgreSQL (用户、配额、使用记录)                       │ │ │
│  │  ├─ Redis (会话缓存、配额缓存)                               │ │ │
│  │  └─ Prometheus + Grafana (监控)                              │ │ │
│  └──────────────────────────────────────────────────────────────┘ │ │
└─────────────────────────────────────────────────────────────────┘

监控指标：
  - 活跃连接数
  - 请求延迟（P50, P95, P99）
  - 错误率
  - CPU/内存使用率
  - Token 消耗量
  - 用户配额使用情况
```

### 扩容建议

**用户规模 vs Gateway 实例数**：

| 用户数 | Gateway 实例 | 并发用户 | 总内存 |
|-------|--------------|---------|--------|
| 100 | 1 | 100 | 5GB |
| 500 | 2 | 250 | 10GB |
| 1,000 | 3 | 333 | 15GB |
| 5,000 | 5 | 1,000 | 50GB |
| 10,000 | 10 | 1,000 | 100GB |

**扩容触发条件**：

```yaml
触发扩容的指标：
  - CPU 使用率 > 70% 持续 5 分钟
  - 内存使用率 > 80%
  - 平均响应时间 > 3 秒
  - 活跃连接数 > 实例容量的 80%

扩容步骤：
  1. 添加新的 Gateway 容器
  2. 等待健康检查通过
  3. 更新负载均衡器配置
  4. 重启负载均衡器
  5. 验证扩容成功
```

### 监控配置

```typescript
// src/monitoring/gateway-metrics.ts

import promClient from 'prom-client';

export const gatewayMetrics = {
  // 连接数
  activeConnections: new promClient.Gauge({
    name: 'openclaw_gateway_active_connections',
    help: 'Number of active WebSocket connections',
    labelNames: ['instance_id'],
  }),

  // 请求数
  totalRequests: new promClient.Counter({
    name: 'openclaw_gateway_requests_total',
    help: 'Total number of requests',
    labelNames: ['instance_id', 'status'],
  }),

  // 响应时间
  requestDuration: new promClient.Histogram({
    name: 'openclaw_gateway_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['instance_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
  }),

  // Token 消耗
  tokensUsed: new promClient.Counter({
    name: 'openclaw_gateway_tokens_used_total',
    help: 'Total tokens consumed',
    labelNames: ['user_id', 'provider', 'model'],
  }),

  // 成本
  costIncurred: new promClient.Counter({
    name: 'openclaw_gateway_cost_usd_total',
    help: 'Total cost incurred in USD',
    labelNames: ['user_id', 'provider', 'model'],
  }),
};

/**
 * 记录指标
 */
export function recordMetric(name: string, value: number, labels?: Record<string, string>): void {
  if (labels) {
    gatewayMetrics[name].inc(labels);
  } else {
    gatewayMetrics[name].inc(value);
  }
}

/**
 * Prometheus 端点
 */
export async function metricsHandler(req: any, res: any): Promise<void> {
  res.set('Content-Type', 'text/plain');
  res.end(await promClient.register.metrics());
}
```

### Docker Compose 完整配置

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=openclaw
      - POSTGRES_USER=openclaw
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  # Redis 缓存
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # Gateway 实例 #1
  gateway-1:
    image: openclaw/gateway:latest
    ports:
      - "19001:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      - OPENCLAW_LOG_LEVEL=info
      - OPENCLAW_CLUSTER_WORKER_ID=gateway-1
    volumes:
      - /data/openclaw-gateway-1:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Gateway 实例 #2
  gateway-2:
    image: openclaw/gateway:latest
    ports:
      - "19002:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      - OPENCLAW_LOG_LEVEL=info
      - OPENCLAW_CLUSTER_WORKER_ID=gateway-2
    volumes:
      - /data/openclaw-gateway-2:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Gateway 实例 #3
  gateway-3:
    image: openclaw/gateway:limited
    ports:
      - "19003:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      - OPENCLAW_LOG_LEVEL=info
      - OPENCLAW_CLUSTER_WORKER_ID=gateway-3
    volumes:
      - /data/openclaw-gateway-3:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # API Gateway + 负载均衡
  api-gateway:
    image: your-registry/openclaw-api-gateway:latest
    ports:
      - "3000:3000"
      - "443:443"
    environment:
      - DATABASE_URL=postgres://openclaw:${POSTGRES_PASSWORD}@postgres:5432/openclaw
      - REDIS_URL=redis://redis:6379
      - GATEWAY_INSTANCES=gateway-1:19001,gateway-2:19002,gateway-3:19003
      - OAUTH_DOMAIN=${OAUTH_DOMAIN}
      - OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID}
      - OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}
    volumes:
      - ./certs:/certs:ro
    depends_on:
      - postgres
      - redis
      - gateway-1
      - gateway-2
      - gateway-3
    restart: unless-stopped

  # Prometheus 监控
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  # Grafana 可视化
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
```

---

## 总结

### 性能容量规划

| 用户规模 | Gateway 实例数 | 预期并发 | 总内存 | 推荐方案 |
|---------|--------------|---------|--------|---------|
| < 100 | 1 | <100 | 5GB | 单实例 + 独立工作区 |
| 100-500 | 2 | 250 | 10GB | 负载均衡 + 2 实例 |
| 500-2,000 | 3-5 | 500-1,000 | 30GB | 负载均衡 + 集群 |
| >2,000 | 5-10 | 2,000+ | 100GB | 负载均衡 + 多实例 + 监控 |

### 关键建议

1. **独立 API Token**：
   - 推荐使用主密钥派生子密钥标识
   - 或为高价值用户分配独立密钥
   - 实现使用追踪和配额管理

2. **Token 消耗统计**：
   - 每次调用记录到数据库
   - 实时更新配额使用
   - 提供使用统计 API

3. **Gateway 性能**：
   - 单实例能支撑 ~100 并发用户
   - 使用负载均衡实现水平扩展
   - 通过集群模式利用多核

4. **监控和告警**：
   - Prometheus + Grafana 监控
   - 设置关键指标告警
   - 实时追踪用户使用情况

5. **扩展性**：
   - Gateway 可以无限水平扩展（多实例）
   - 数据层可扩展（读写分离、分片）
   - 不存在硬性瓶颈

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
