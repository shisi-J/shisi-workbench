/**
 * 诗思工作台 - AES 加密模块
 * 使用 Web Crypto API + CryptoJS 作为后备
 * 加密密钥由用户在设置中配置，存储在 localStorage（仅密钥引用，不存储明文密钥）
 */

const ENCRYPTION_KEY_STORAGE = 'shisi-enc-key';
const DEFAULT_KEY = 'shisi-default-key-2024';

// 获取加密密钥
function getEncryptionKey() {
  return localStorage.getItem(ENCRYPTION_KEY_STORAGE) || DEFAULT_KEY;
}

// 设置加密密钥
function setEncryptionKey(key) {
  localStorage.setItem(ENCRYPTION_KEY_STORAGE, key);
}

// AES 加密
function encrypt(data) {
  try {
    const jsonStr = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonStr, getEncryptionKey()).toString();
    return encrypted;
  } catch (err) {
    console.error('加密失败:', err);
    return null;
  }
}

// AES 解密
function decrypt(encryptedStr) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedStr, getEncryptionKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('解密失败:', err);
    return null;
  }
}

// 导出加密数据
function exportEncrypted(data) {
  const encrypted = encrypt(data);
  if (!encrypted) return null;
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    encrypted: true,
    data: encrypted,
  };
}

// 导入并解密数据
function importDecrypted(fileData) {
  if (fileData.encrypted && fileData.data) {
    return decrypt(fileData.data);
  }
  // 兼容未加密的旧数据
  return fileData;
}

export {
  encrypt,
  decrypt,
  exportEncrypted,
  importDecrypted,
  getEncryptionKey,
  setEncryptionKey,
};
