/**
 * 设置页面
 */

import { exportToFile, importFromFile, getSetting, setSetting } from '../db.js';
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
        </div>

        <!-- 安全设置 -->
        <div class="card">
          <div class="card-title mb-3">🔒 加密设置</div>
          <div class="form-group">
            <label class="form-label">加密密钥</label>
            <input type="password" class="form-input" id="encKey" value="${encKey}" placeholder="设置加密密钥">
            <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 4px;">
              ⚠️ 密钥用于加密本地数据，请妥善保管。更换密钥后旧备份将无法解密。
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
            <span class="setting-value">1.0.0</span>
          </div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">部署方式</span>
            <span class="setting-value">GitHub Pages (PWA)</span>
          </div>
          <div class="setting-item" style="padding: 0;">
            <span class="setting-label">数据存储</span>
            <span class="setting-value">本地 IndexedDB (AES加密)</span>
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

    // 加密密钥
    document.getElementById('saveEncKey')?.addEventListener('click', () => {
      const key = document.getElementById('encKey').value.trim();
      if (!key) { window.showToast('密钥不能为空'); return; }
      setEncryptionKey(key);
      window.showToast('✅ 密钥已保存');
    });
  }

  onDestroy() {}
}
