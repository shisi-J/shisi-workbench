/**
 * 通用附件工具模块
 * 供所有页面模块复用：文件上传、展示、预览、下载
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 获取文件图标
export function getFileIcon(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type.includes('pdf')) return '📕';
  if (type.includes('word') || type.includes('document')) return '📘';
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📗';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📙';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '🗜️';
  if (type.includes('json') || type.includes('text') || type.includes('markdown')) return '📝';
  if (type.includes('audio')) return '🎵';
  if (type.includes('video')) return '🎬';
  return '📄';
}

// 格式化文件大小
export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

// 文件转 DataURL
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 下载附件
export function downloadAttachment(att) {
  const link = document.createElement('a');
  link.href = att.dataUrl;
  link.download = att.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// 预览附件
export function previewAttachment(att) {
  if (att.type?.startsWith('image/') || att.type?.includes('pdf')) {
    const w = window.open('');
    if (w) {
      w.document.write(att.type?.includes('pdf')
        ? `<iframe src="${att.dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`
        : `<img src="${att.dataUrl}" style="max-width:100%;height:auto;">`);
      w.document.title = att.name;
    }
  } else {
    downloadAttachment(att);
  }
}

/**
 * 渲染卡片中的附件列表 HTML
 * @param {Array} attachments - 附件数组
 * @param {string} itemId - 所属记录 ID
 * @returns {string} HTML 字符串
 */
export function renderAttachmentList(attachments, itemId) {
  if (!attachments || attachments.length === 0) return '';
  return `
    <div class="learn-attachments">
      <div class="learn-attachments-header">📎 附件（${attachments.length}）</div>
      <div class="learn-attachments-list">
        ${attachments.map((att, i) => `
          <div class="learn-attachment-item" data-att-idx="${i}" data-item-id="${itemId}">
            <span class="learn-attachment-icon">${getFileIcon(att.type)}</span>
            <span class="learn-attachment-name">${att.name}</span>
            <span class="learn-attachment-size">${formatFileSize(att.size)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 渲染表单中的附件上传区域 HTML
 * @param {Array} existingAttachments - 已有附件
 * @returns {string} HTML 字符串
 */
export function renderUploadField(existingAttachments = []) {
  return `
    <div class="form-group">
      <label class="form-label">📎 附件（选填）</label>
      <div id="attachmentList" style="display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-2);">
        ${existingAttachments.map((att, i) => `
          <div class="attachment-row" data-att-row="${i}">
            <span>${getFileIcon(att.type)}</span>
            <span class="attachment-row-name">${att.name}</span>
            <span class="attachment-row-size">${formatFileSize(att.size)}</span>
            <button type="button" class="attachment-remove" data-att-remove="${i}" style="background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;padding:2px 6px;">✕</button>
          </div>
        `).join('')}
      </div>
      <label class="btn btn-outline btn-sm" style="display:block;text-align:center;cursor:pointer;border:2px dashed var(--border-default);">
        📁 选择文件上传
        <input type="file" id="fileInput" multiple style="display:none;" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.json,.zip,.rar">
      </label>
      <div id="uploadStatus" style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px;text-align:center;"></div>
    </div>
  `;
}

/**
 * 初始化上传事件处理器
 * @param {HTMLElement} modal - 弹窗 DOM 元素
 * @param {Array} existingAttachments - 已有附件（会被修改）
 * @returns {Array} 当前附件数组引用（过滤 null 后即为最终结果）
 */
export function initUploadHandlers(modal, existingAttachments) {
  let pendingAttachments = [...existingAttachments];

  const fileInput = modal.querySelector('#fileInput');
  const statusEl = modal.querySelector('#uploadStatus');
  const listEl = modal.querySelector('#attachmentList');

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          if (statusEl) statusEl.textContent = `⚠️ ${file.name} 超过10MB限制，已跳过`;
          continue;
        }
        if (statusEl) statusEl.textContent = `⏳ 正在读取 ${file.name}...`;
        try {
          const dataUrl = await fileToDataUrl(file);
          pendingAttachments.push({ name: file.name, type: file.type, size: file.size, dataUrl });
          if (listEl) {
            const row = document.createElement('div');
            row.className = 'attachment-row';
            row.dataset.attRow = pendingAttachments.length - 1;
            row.innerHTML = `
              <span>${getFileIcon(file.type)}</span>
              <span class="attachment-row-name">${file.name}</span>
              <span class="attachment-row-size">${formatFileSize(file.size)}</span>
              <button type="button" class="attachment-remove" data-att-remove="${pendingAttachments.length - 1}" style="background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;padding:2px 6px;">✕</button>
            `;
            listEl.appendChild(row);
          }
          if (statusEl) statusEl.textContent = `✅ ${file.name} 已添加`;
        } catch (err) {
          if (statusEl) statusEl.textContent = `❌ ${file.name} 读取失败`;
        }
      }
      e.target.value = '';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    });
  }

  // 删除附件
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('attachment-remove')) {
      const idx = parseInt(e.target.dataset.attRemove);
      pendingAttachments[idx] = null;
      e.target.closest('.attachment-row')?.remove();
    }
  });

  // 返回一个 getter 函数，调用时获取过滤后的附件
  return () => pendingAttachments.filter(a => a !== null);
}

/**
 * 绑定卡片中附件的点击事件
 * @param {Array} records - 记录数组
 * @param {string} idField - 记录 ID 字段名（默认 'id'）
 */
export function bindCardAttachmentClicks(records, idField = 'id') {
  document.querySelectorAll('.learn-attachment-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = parseInt(el.getAttribute('data-item-id'));
      const attIdx = parseInt(el.getAttribute('data-att-idx'));
      const item = records.find(r => r[idField] === itemId);
      if (item) {
        const attachments = item.attachments || item.fields?.attachments;
        if (attachments && attachments[attIdx]) {
          previewAttachment(attachments[attIdx]);
        }
      }
    });
  });
}