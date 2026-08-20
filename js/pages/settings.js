/**
 * 设置页面
 */

import { exportToFile, importFromFile, listBackups, restoreBackup, cloudSync, cloudRestore, getCloudSyncInfo, getSetting, setSetting, validateGitHubToken } from '../db.js';
import { getStoredTheme, applyTheme, toggleTheme } from '../theme.js';
import { setEncryptionKey, getEncryptionKey } from '../crypto.js';

export default class SettingsPage {
  constructor({ container }) {
    this.container = container;
  }

  async render() {
    const theme = getStoredTheme();
    const aiKey = localStorage.getItem('shisi-ai-key') || '';
    const aiUrl = localStorage.getItem('shisi-ai-url') || 'https://api.chatanywhere.tech/v1/chat/completions';
    const aiModel = localStorage.getItem('shisi-ai-model') || 'gpt-3.5-turbo';
    const encKey = getEncryptionKey();
    let appVersion = '1.0.0';
    try {
      const res = await fetch('sw.js', { cache: 'no-store' });
      const text = await res.text();
      const m = text.match(/shisi-v(\d+\.\d+\.\d+)/);
      if (m) appVersion = m[1];
    } catch (e) {}

    this.container.innerHTML = `
      <div class="settings-page">
        <div class="page-header">
          <div class="page-title">⚙️ 设置</div>
          <div class="page-subtitle">个性化你的诗思工作台</div>
        </div>

        <!-- 主题设置 -->
        <div class="card">
          <div class="card-title mb-3">🎨 外观</div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">主题模式</span>
            <div style="display: flex; gap: var(--space-1);">
              <button class="filter-chip ${theme === 'light' ? 'active' : ''}" data-theme="light">☀️ 浅色</button>
              <button class="filter-chip ${theme === 'dark' ? 'active' : ''}" data-theme="dark">🌙 深色</button>
              <button class="filter-chip ${theme === 'auto' ? 'active' : ''}" data-theme="auto">🔄 自动</button>
            </div>
          </div>
        </div>

        <!-- AI 设置 -->
        <div class="card">
          <div class="card-title mb-3">🤖 AI 对话设置</div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <input type="password" class="form-input" id="aiKey" value="${aiKey}" placeholder="输入 API Key">
          </div>
          <div class="form-group">
            <label class="form-label">API 地址</label>
            <input type="url" class="form-input" id="aiUrl" value="${aiUrl}" placeholder="https://api.example.com/v1/chat/completions">
          </div>
          <div class="form-group">
            <label class="form-label">模型名称</label>
            <input type="text" class="form-input" id="aiModel" value="${aiModel}" placeholder="gpt-3.5-turbo">
          </div>
          <div style="padding: var(--space-3); background: var(--bg-inset); border-radius: var(--radius-sm); font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.8;">
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2);">📋 免费API配置指南（三选一）</div>
            <div style="margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-color);">
              <div style="font-weight: 600; color: var(--brand);">方案一：SiliconFlow（硅基流动）- 推荐</div>
              <div>1. 访问 <a href="https://cloud.siliconflow.cn" target="_blank" style="color: var(--brand);">cloud.siliconflow.cn</a> 注册账号</div>
              <div>2. 新用户注册即送 14 元免费额度</div>
              <div>3. 进入「API密钥」页面，点击「新建密钥」</div>
              <div>4. 复制密钥，填入上方 API Key</div>
              <div>5. API地址填：<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;">https://api.siliconflow.cn/v1/chat/completions</code></div>
              <div>6. 模型填：<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;">Qwen/Qwen2.5-7B-Instruct</code></div>
              <div>7. 其他可用模型：deepseek-ai/DeepSeek-V3、Pro/Qwen/Qwen2.5-72B</div>
            </div>
            <div style="margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-color);">
              <div style="font-weight: 600; color: var(--brand);">方案二：ChatAnywhere（免费GPT代理）</div>
              <div>1. 访问 <a href="https://github.com/chatanywhere/GPT_API_free" target="_blank" style="color: var(--brand);">github.com/chatanywhere</a></div>
              <div>2. 点击 README 中的「申请免费内测密钥」</div>
              <div>3. 填写 GitHub 用户名和用途，等待邮件通知</div>
              <div>4. 收到密钥后填入 API Key</div>
              <div>5. API地址（免费版）：<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;">https://api.chatanywhere.tech/v1/chat/completions</code></div>
              <div>6. 模型填：<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;">gpt-3.5-turbo</code></div>
              <div>⚠️ 免费版每分钟限制 60 次请求</div>
            </div>
            <div>
              <div style="font-weight: 600; color: var(--brand);">方案三：DeepSeek（极低成本）</div>
              <div>1. 访问 <a href="https://platform.deepseek.com" target="_blank" style="color: var(--brand);">platform.deepseek.com</a> 注册</div>
              <div>2. 充值 1 元即可使用（价格极低）</div>
              <div>3. 在「API Keys」页面创建密钥</div>
              <div>4. API地址：<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;">https://api.deepseek.com/v1/chat/completions</code></div>
              <div>5. 模型填：<code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;">deepseek-chat</code></div>
              <div>💡 百万token约1元，日常对话用不了多少</div>
            </div>
          </div>
          <button class="btn btn-primary btn-block mt-3" id="saveAI">保存 AI 设置</button>
        </div>

        <!-- 数据管理 -->
        <div class="card">
          <div class="card-title mb-3">💾 数据管理</div>
          <div class="setting-item" style="padding: 0; margin-bottom: var(--space-3);">
            <div>
              <div class="setting-label">导出备份</div>
              <div class="setting-value">导出 AES 加密的数据备份文件</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="exportBtn">📤 导出</button>
          </div>
          <div class="setting-item" style="padding: 0; margin-bottom: var(--space-3);">
            <div>
              <div class="setting-label">导入备份</div>
              <div class="setting-value">从备份文件恢复数据</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="importBtn">📥 导入</button>
            <input type="file" id="importFile" accept=".json" style="display: none;">
          </div>
          <div class="setting-item" style="padding: 0; margin-bottom: var(--space-3);">
            <div>
              <div class="setting-label">自动备份恢复</div>
              <div class="setting-value">系统每 5 秒自动备份最近 3 份数据快照</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="showBackupsBtn">🕐 查看备份</button>
          </div>
        </div>

        <!-- 云同步 -->
        <div class="card-section">
          <div class="card-section-title">☁️ 云同步备份</div>
          <div class="setting-item" style="padding: 0; margin-bottom: var(--space-3);">
            <div>
              <div class="setting-label">GitHub Token</div>
              <div class="setting-value" id="cloudSyncStatus">检查中...</div>
            </div>
            <div style="display: flex; gap: var(--space-1);">
              <button class="btn btn-secondary btn-sm" id="validateTokenBtn" style="font-size: var(--font-xs); padding: 4px 8px;">验证</button>
              <button class="btn btn-secondary btn-sm" id="configTokenBtn">🔑 配置</button>
            </div>
          </div>
          <div class="setting-item" style="padding: 0; margin-bottom: var(--space-3);">
            <div>
              <div class="setting-label">立即同步</div>
              <div class="setting-value">上传数据到 GitHub Gist（加密）</div>
            </div>
            <button class="btn btn-primary btn-sm" id="cloudSyncBtn">☁️ 同步</button>
          </div>
          <div class="setting-item" style="padding: 0; margin-bottom: var(--space-3);">
            <div>
              <div class="setting-label">从云端恢复</div>
              <div class="setting-value">清除浏览器数据后可从此恢复</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="cloudRestoreBtn">📥 恢复</button>
          </div>
        </div>

        <!-- 安全设置 -->
        <div class="card">
          <div class="card-title mb-3">🔒 加密设置</div>
          <div class="form-group">
            <label class="form-label">加密密钥</label>
            <input type="password" class="form-input" id="encKey" value="${encKey}" placeholder="设置加密密钥">
            <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 4px;">
              ⚠️ 密钥用于加密云同步数据。<strong>两端必须使用相同密钥</strong>，否则恢复时解密失败。如果没改过密钥，保持默认即可。
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="saveEncKey">保存密钥</button>
        </div>

        <!-- 关于 -->
        <div class="card">
          <div class="card-title mb-3">ℹ️ 关于</div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">应用名称</span>
            <span class="setting-value">诗思工作台</span>
          </div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">版本</span>
            <span class="setting-value">${appVersion}</span>
          </div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">部署方式</span>
            <span class="setting-value">GitHub Pages (PWA)</span>
          </div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">数据存储</span>
            <span class="setting-value">本地 IndexedDB (AES加密)</span>
          </div>
          <div class="setting-item" style="padding: 0; margin-top: var(--space-2);">
            <div>
              <div class="setting-label">强制更新</div>
              <div class="setting-value" style="font-size: var(--font-xs);">清除所有缓存并重新加载最新版本</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="forceUpdateBtn">🔄 强制更新</button>
          </div>
        </div>

        <div style="text-align: center; padding: var(--space-4); color: var(--text-tertiary); font-size: var(--font-sm);">
          诗思 · 工作·学习·生活 ✨
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    // 云同步状态显示
    this._updateCloudStatus();

    // === 以下为原有事件绑定 ===

    // 配置 GitHub Token
    document.getElementById('configTokenBtn')?.addEventListener('click', async () => {
      const currentToken = await getSetting('github_token', '');
      const div = document.createElement('div');
      div.className = 'modal-overlay active';
      div.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">🔑 配置 GitHub Token</div>
            <button class="modal-close" id="tokenClose">✕</button>
          </div>
          <div style="padding: var(--space-3);">
            <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-bottom: var(--space-3); line-height: 1.6;">
              1. 访问 https://github.com/settings/tokens/new<br>
              2. 勾选 <code>gist</code> 权限<br>
              3. 生成 Token 并粘贴到下方<br>
              <br>
              Token 仅存储在本地 IndexedDB，不上传到任何服务器
            </div>
            <input class="form-input" id="tokenInput" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ghp_xxxxxxxx" value="${currentToken}" style="width:100%; margin-bottom: var(--space-2); font-family: monospace; font-size: var(--font-xs);">
            <div id="tokenDebug" style="font-size: var(--font-xs); color: var(--text-tertiary); margin-bottom: var(--space-2); word-break: break-all;"></div>
            <button class="btn btn-primary btn-block" id="tokenSave">保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      const close = () => { div.remove(); this._updateCloudStatus(); };
      document.getElementById('tokenClose').addEventListener('click', close);
      div.addEventListener('click', e => { if (e.target === div) close(); });

      // 实时显示 Token 信息（前4位+后4位+长度）
      const tokenInput = document.getElementById('tokenInput');
      const tokenDebug = document.getElementById('tokenDebug');
      const updateDebug = () => {
        const v = tokenInput.value.trim();
        if (!v) { tokenDebug.textContent = ''; return; }
        const prefix = v.slice(0, 4);
        const suffix = v.slice(-4);
        tokenDebug.textContent = `长度: ${v.length} | 前缀: ${prefix}... | 后缀: ...${suffix} | 格式: ${v.startsWith('ghp_') ? 'Classic ✓' : v.startsWith('github_pat_') ? 'Fine-grained ⚠️' : '未知格式 ⚠️'}`;
      };
      tokenInput.addEventListener('input', updateDebug);
      updateDebug();

      document.getElementById('tokenSave').addEventListener('click', async () => {
        const val = tokenInput.value.trim();
        if (val && !val.startsWith('ghp_') && !val.startsWith('github_pat_')) {
          window.showToast('Token 格式异常，应以 ghp_ 开头', 4000);
          return;
        }
        await setSetting('github_token', val);
        // 同时存到 localStorage，清除 IndexedDB 后仍可恢复
        if (val) {
          localStorage.setItem('shisi-github-token', val);
        } else {
          localStorage.removeItem('shisi-github-token');
        }
        window.showToast(val ? `✅ Token 已保存（${val.length}字符）` : 'Token 已清除');
        close();
      });
    });

    // 验证 GitHub Token
    document.getElementById('validateTokenBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('validateTokenBtn');
      btn.textContent = '⏳';
      btn.disabled = true;
      try {
        const result = await validateGitHubToken();
        window.showToast(result.message, 5000);
      } catch (e) {
        window.showToast('验证异常: ' + e.message, 5000);
      }
      btn.textContent = '验证';
      btn.disabled = false;
    });

    // 手动云同步
    document.getElementById('cloudSyncBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('cloudSyncBtn');
      btn.textContent = '⏳ 同步中...';
      btn.disabled = true;
      try {
        await cloudSync();
        window.showToast('☁️ 云同步成功');
      } catch (err) {
        if (err.message.includes('无效或已过期')) {
          window.showToast('Token 已失效，请点击「配置」重新生成 Token', 5000);
        } else if (err.message.includes('限流')) {
          window.showToast('GitHub API 限流，请稍后重试', 4000);
        } else {
          window.showToast('同步失败: ' + err.message, 4000);
        }
      }
      btn.textContent = '☁️ 同步';
      btn.disabled = false;
      this._updateCloudStatus();
    });

    // 从云端恢复
    document.getElementById('cloudRestoreBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('cloudRestoreBtn');
      btn.textContent = '⏳ 恢复中...';
      btn.disabled = true;
      try {
        await cloudRestore();
        window.showToast('✅ 已从云端恢复');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        if (err.message.includes('解密失败')) {
          window.showToast('解密失败：请确保加密密钥与同步端一致', 5000);
        } else {
          window.showToast('恢复失败: ' + err.message, 4000);
        }
      }
      btn.textContent = '📥 恢复';
      btn.disabled = false;
    });

    // 主题
    document.querySelectorAll('[data-theme]').forEach(el => {
      el.addEventListener('click', () => {
        const theme = el.getAttribute('data-theme');
        localStorage.setItem('shisi-theme', theme);
        applyTheme(theme);
        this.render();
        const labels = { light: '浅色', dark: '深色', auto: '跟随系统' };
        window.showToast(`主题：${labels[theme]}`);
      });
    });

    // AI 设置
    document.getElementById('saveAI')?.addEventListener('click', () => {
      localStorage.setItem('shisi-ai-key', document.getElementById('aiKey').value.trim());
      localStorage.setItem('shisi-ai-url', document.getElementById('aiUrl').value.trim());
      localStorage.setItem('shisi-ai-model', document.getElementById('aiModel').value.trim());
      window.showToast('✅ AI 设置已保存');
    });

    // 导出
    document.getElementById('exportBtn')?.addEventListener('click', async () => {
      try {
        await exportToFile();
        window.showToast('✅ 备份已导出');
      } catch (e) {
        window.showToast('导出失败: ' + e.message);
      }
    });

    // 导入
    document.getElementById('importBtn')?.addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await importFromFile(file);
        window.showToast('✅ 数据已恢复');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        window.showToast('导入失败: ' + err.message);
      }
    });

    // 自动备份恢复
    document.getElementById('showBackupsBtn')?.addEventListener('click', async () => {
      const backups = await listBackups();
      if (backups.length === 0) {
        window.showToast('暂无自动备份记录');
        return;
      }
      const div = document.createElement('div');
      div.className = 'modal-overlay active';
      div.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">🕐 自动备份记录</div>
            <button class="modal-close" id="backupClose">✕</button>
          </div>
          <div style="padding: var(--space-3);">
            <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-bottom: var(--space-2);">
              恢复备份会覆盖当前数据，请谨慎操作
            </div>
            ${backups.map(b => `
              <div class="setting-item" style="padding: var(--space-2) 0; border-bottom: 1px solid var(--border-light);">
                <div>
                  <div class="setting-label">备份 ${b.id}</div>
                  <div class="setting-value">${b.date}</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-restore="${b.id}">恢复</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      document.body.appendChild(div);
      const close = () => div.remove();
      document.getElementById('backupClose').addEventListener('click', close);
      div.addEventListener('click', e => { if (e.target === div) close(); });
      div.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-restore'));
          try {
            await restoreBackup(id);
            window.showToast('✅ 已恢复备份');
            setTimeout(() => location.reload(), 1000);
          } catch (err) {
            window.showToast('恢复失败: ' + err.message);
          }
        });
      });
    });

    // 加密密钥
    document.getElementById('saveEncKey')?.addEventListener('click', () => {
      const key = document.getElementById('encKey').value.trim();
      if (!key) { window.showToast('密钥不能为空'); return; }
      setEncryptionKey(key);
      window.showToast('✅ 密钥已保存');
    });

    // 强制更新：清除所有 SW 缓存并重新注册
    document.getElementById('forceUpdateBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('forceUpdateBtn');
      btn.textContent = '⏳ 清理中...';
      btn.disabled = true;
      try {
        // 注销所有 SW
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        // 清除所有缓存
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
        window.showToast('✅ 缓存已清除，正在重新加载...', 2000);
        // 硬刷新
        setTimeout(() => {
          window.location.href = window.location.origin + window.location.pathname + '?t=' + Date.now();
        }, 1500);
      } catch (e) {
        window.showToast('清理失败: ' + e.message, 4000);
        btn.textContent = '🔄 强制更新';
        btn.disabled = false;
      }
    });
  }

  async _updateCloudStatus() {
    const el = document.getElementById('cloudSyncStatus');
    if (!el) return;
    try {
      const info = await getCloudSyncInfo();
      if (!info.configured) {
        el.textContent = '未配置 Token';
        el.style.color = 'var(--text-tertiary)';
      } else if (!info.hasGist) {
        el.textContent = '已配置，尚未同步';
        el.style.color = 'var(--text-secondary)';
      } else {
        el.textContent = `上次同步: ${info.lastSync}`;
        el.style.color = 'var(--text-tertiary)';
      }
    } catch (e) {
      el.textContent = '状态获取失败';
    }
  }

  onDestroy() {}
}
