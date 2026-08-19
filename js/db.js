/**
 * 诗思工作台 - IndexedDB 数据库封装
 * 基于 Dexie.js，提供增删改查 + AES 加密存储
 */

import { encrypt, decrypt, exportEncrypted, importDecrypted } from './crypto.js';

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 数据库名称和版本
const DB_NAME = 'ShisiWorkbench';
const DB_VERSION = 5;

// 创建数据库
const db = new Dexie(DB_NAME);

db.version(DB_VERSION).stores({
  // 日程待办 - 任务（仅截止时间）
  todos: '++id, title, date, done, priority, category, sourceModule, sourceId, status, repeatRule, createdAt',
  // 日程 - 带时间段的事件
  events: '++id, title, startDate, endDate, startTime, endTime, location, participants, sourceModule, sourceId, repeatRule, tags, createdAt',
  // 重复模板库
  repeatTemplates: '++id, title, type, repeatRule, category, priority, content, createdAt',
  // 感悟输出
  insights: '++id, title, content, tags, mood, createdAt, updatedAt',
  // 灵感库 - 全网链接收藏
  inspirations: '++id, url, title, platform, author, cover, summary, tags, notes, favorite, createdAt, updatedAt',
  // 学习内容（视频链接+笔记）
  learnings: '++id, category, title, description, url, platform, cover, tags, notes, checked, checkedAt, createdAt, updatedAt',
  // 播客对话（每日播客）
  podcasts: '++id, title, description, url, platform, cover, type, tags, notes, checked, checkedAt, duration, createdAt, updatedAt',
  // 工作台账（通用表结构，用 category 区分不同工作模块）
  workRecords: '++id, category, title, fields, status, createdAt, updatedAt',
  // 生活记录（通用表结构）
  lifeRecords: '++id, category, title, fields, createdAt, updatedAt',
  // 能量工作台 - 金句
  quotes: '++id, content, source, tags, favorite, createdAt',
  // 能量工作台 - 情绪记录
  moods: '++id, mood, note, date, createdAt',
  // 能量工作台 - 每日打卡
  checkins: '++id, type, date, note, createdAt',
  // 能量工作台 - 日记/微行动记录
  diaries: '++id, content, type, date, createdAt',
  // 个人知识库
  knowledge: '++id, title, content, category, tags, createdAt, updatedAt',
  // 工作流
  workflows: '++id, title, steps, category, createdAt, updatedAt',
  // 设置
  settings: 'key, value, updatedAt',
  // 自动备份（内部使用，保存最近3份数据快照）
  _backups: '++id, ts, tables',
});

// === 通用 CRUD 操作 ===

// 防抖自动备份：写入操作后 5 秒自动备份
let _backupTimer = null;
async function _autoBackup() {
  if (_backupTimer) clearTimeout(_backupTimer);
  _backupTimer = setTimeout(async () => {
    try {
      const tables = {};
      for (const t of db.tables) {
        if (t.name === '_backups') continue;
        tables[t.name] = await t.toArray();
      }
      await db.table('_backups').add({ ts: Date.now(), tables: JSON.stringify(tables) });
      // 只保留最近 3 份备份
      const all = await db.table('_backups').orderBy('id').reverse().toArray();
      if (all.length > 3) {
        const toDelete = all.slice(3).map(b => b.id);
        await db.table('_backups').bulkDelete(toDelete);
      }
    } catch (e) {
      console.log('自动备份失败:', e);
    }
    _backupTimer = null;
  }, 5000);
  // 同时触发云同步（30秒防抖）
  _autoCloudSync();
}

// 添加记录
async function add(table, data) {
  const now = new Date().toISOString();
  const record = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.table(table).add(record);
  _autoBackup();
  return result;
}

// 批量添加
async function bulkAdd(table, dataArray) {
  const now = new Date().toISOString();
  const records = dataArray.map(d => ({
    ...d,
    createdAt: now,
    updatedAt: now,
  }));
  const result = await db.table(table).bulkAdd(records);
  _autoBackup();
  return result;
}

// 更新记录
async function update(table, id, data) {
  const updateData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const result = await db.table(table).update(id, updateData);
  _autoBackup();
  return result;
}

// 删除记录
async function remove(table, id) {
  const result = await db.table(table).delete(id);
  _autoBackup();
  return result;
}

// 获取单条
async function get(table, id) {
  return await db.table(table).get(id);
}

// 获取全部
async function getAll(table) {
  return await db.table(table).toArray();
}

// 按条件查询
async function query(table, whereClause) {
  let collection = db.table(table);
  if (whereClause) {
    const keys = Object.keys(whereClause);
    for (const key of keys) {
      collection = collection.where(key).equals(whereClause[key]);
    }
  }
  return await collection.toArray();
}

// 按分类查询
async function getByCategory(table, category) {
  return await db.table(table)
    .where('category')
    .equals(category)
    .reverse()
    .sortBy('createdAt');
}

// 清空表
async function clearTable(table) {
  return await db.table(table).clear();
}

// === 统计 ===

// 获取记录数
async function count(table, whereClause) {
  let collection = db.table(table);
  if (whereClause) {
    collection = collection.where(Object.keys(whereClause)[0]).equals(Object.values(whereClause)[0]);
  }
  return await collection.count();
}

// === 导入导出 ===

// 导出全部数据（AES 加密）
async function exportAll() {
  const tables = db.tables.map(t => t.name);
  const data = {};
  for (const table of tables) {
    data[table] = await db.table(table).toArray();
  }
  return exportEncrypted(data);
}

// 导入数据（解密并恢复）
async function importAll(fileData) {
  const data = importDecrypted(fileData);
  if (!data) {
    throw new Error('数据解密失败，请检查密钥是否正确');
  }
  // 清空并恢复
  for (const tableName of Object.keys(data)) {
    if (db.table(tableName)) {
      await db.table(tableName).clear();
      if (data[tableName].length > 0) {
        await db.table(tableName).bulkAdd(data[tableName]);
      }
    }
  }
  return true;
}

// 导出为文件
async function exportToFile() {
  const data = await exportAll();
  if (!data) {
    throw new Error('导出失败');
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = localDateStr(new Date());
  a.href = url;
  a.download = `shisi-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 从文件导入
async function importFromFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  await importAll(data);
  return true;
}

// 从自动备份恢复（返回最近的备份列表）
async function listBackups() {
  try {
    const all = await db.table('_backups').orderBy('id').reverse().toArray();
    return all.map(b => ({
      id: b.id,
      ts: b.ts,
      date: new Date(b.ts).toLocaleString('zh-CN'),
    }));
  } catch (e) {
    return [];
  }
}

// 恢复指定备份
async function restoreBackup(backupId) {
  const backup = await db.table('_backups').get(backupId);
  if (!backup || !backup.tables) throw new Error('备份不存在');
  const data = JSON.parse(backup.tables);
  for (const tableName of Object.keys(data)) {
    if (db.table(tableName) && tableName !== '_backups') {
      await db.table(tableName).clear();
      if (data[tableName].length > 0) {
        await db.table(tableName).bulkAdd(data[tableName]);
      }
    }
  }
  return true;
}

// === 种子数据初始化 ===

// 学习模块种子数据
const LEARN_SEED = {
  expression: [
    {
      title: '金字塔原理：结构化表达的核心',
      description: '学会用金字塔结构组织语言，让对方一听就懂',
      url: 'https://www.bilibili.com/video/BV1x411Y7',
      platform: 'bilibili',
      tags: ['口才', '职场沟通'],
      notes: '结论先行 → 以上统下 → 归类分组 → 逻辑递进',
      chapters: [
        { title: '什么是金字塔原理', done: true },
        { title: '结论先行的三个要点', done: true },
        { title: 'MECE原则：不重叠不遗漏', done: false },
        { title: '实战演练：工作汇报', done: false },
      ],
    },
    {
      title: '演讲开场白的5种黄金公式',
      description: '好的开场是成功的一半，掌握这5种开场方式',
      url: '',
      platform: 'other',
      tags: ['演讲'],
      notes: '提问开场、故事开场、数据开场、引用开场、悬念开场',
      chapters: [
        { title: '提问式开场', done: false },
        { title: '故事型开场', done: false },
        { title: '数据冲击开场', done: false },
      ],
    },
    {
      title: '高情商沟通：如何优雅地说不',
      description: '职场中拒绝别人的艺术，既不伤和气又守住边界',
      url: 'https://www.xiaohongshu.com/explore/abc123',
      platform: 'xhs',
      tags: ['职场沟通', '文案写作'],
      notes: '先肯定后转折 → 给替代方案 → 表达善意',
      chapters: [],
    },
    {
      title: '即兴发言万能模板',
      description: '职场会议/聚餐/活动突然被点名发言，5个万能公式让你从容应对',
      url: '',
      platform: 'other',
      tags: ['演讲', '职场沟通'],
      notes: '感谢+回顾+展望 → 问题+原因+方案 → 过去+现在+未来 → 观点+理由+举例+总结',
      chapters: [
        { title: '感谢-回顾-展望公式', done: false },
        { title: '问题-原因-方案公式', done: false },
        { title: '过去-现在-未来公式', done: false },
        { title: 'PREP表达法', done: false },
      ],
    },
    {
      title: '非暴力沟通四步法',
      description: '马歇尔·卢森堡经典沟通方法：观察→感受→需要→请求',
      url: '',
      platform: 'other',
      tags: ['职场沟通', '情绪管理'],
      notes: '说观察不说评判 → 说感受不说想法 → 说需要不说指责 → 说请求不说命令',
      chapters: [
        { title: '区分观察与评判', done: false },
        { title: '表达感受与需要', done: false },
        { title: '提出具体请求', done: false },
        { title: '倾听他人', done: false },
      ],
    },
    {
      title: '麦肯锡SCQA故事框架',
      description: '麦肯锡经典写作框架：情境→冲突→疑问→解答，让你的表达更有逻辑',
      url: '',
      platform: 'other',
      tags: ['口才', '职场沟通', '文案写作'],
      notes: 'Situation情境 → Complication冲突 → Question疑问 → Answer解答',
      chapters: [
        { title: 'S：设定情境', done: false },
        { title: 'C：引入冲突', done: false },
        { title: 'Q：提出疑问', done: false },
        { title: 'A：给出解答', done: false },
      ],
    },
  ],
  ai: [
    {
      title: 'ChatGPT提示词工程入门',
      description: '从零学会写高质量Prompt，让AI输出更精准',
      url: 'https://www.bilibili.com/video/BV1AI4y1',
      platform: 'bilibili',
      tags: ['ChatGPT', 'AI写作'],
      notes: '角色设定 + 任务描述 + 约束条件 + 输出格式',
      chapters: [
        { title: 'Prompt基本结构', done: true },
        { title: 'Few-shot Learning技巧', done: false },
        { title: 'Chain of Thought思维链', done: false },
      ],
    },
    {
      title: 'Midjourney保姆级教程',
      description: '零基础学AI绘画，从注册到出图全流程',
      url: 'https://www.douyin.com/video/7234',
      platform: 'douyin',
      tags: ['AI绘画'],
      notes: '/imagine → 描述词 + 风格 + 参数',
      chapters: [
        { title: '注册与基础设置', done: true },
        { title: '常用参数详解', done: false },
      ],
    },
    {
      title: '吴恩达 ChatGPT Prompt Engineering（免费课程）',
      description: 'DeepLearning.AI与OpenAI联合出品，1.5小时掌握提示词工程核心技巧',
      url: 'https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/',
      platform: 'other',
      tags: ['ChatGPT', 'Prompt', '免费课程'],
      notes: '吴恩达亲授，涵盖：Prompt准则 → 迭代优化 → 文本摘要 → 文本推理 → 文本转换 → 文本扩展 → 聊天机器人',
      chapters: [
        { title: 'Introduction 引言', done: false },
        { title: 'Guidelines 提示词准则', done: false },
        { title: 'Iterative 迭代优化', done: false },
        { title: 'Summarizing 文本摘要', done: false },
        { title: 'Inferring 文本推理', done: false },
        { title: 'Transforming 文本转换', done: false },
        { title: 'Expanding 文本扩展', done: false },
        { title: 'Chatbot 聊天机器人', done: false },
      ],
    },
    {
      title: '吴恩达Prompt工程中文版（网易公开课）',
      description: 'ChatGPT提示工程师全9集中文翻译版，AI大神吴恩达教你写提示词',
      url: 'https://open.163.com/newview/movie/courseintro?newurl=LI35K8001',
      platform: 'other',
      tags: ['ChatGPT', 'Prompt', '中文课程'],
      notes: '中文完整版全9集，适合英语不好的同学跟着学，每集15-20分钟',
      chapters: [
        { title: '第1集 引言', done: false },
        { title: '第2集 指南', done: false },
        { title: '第3集 迭代', done: false },
        { title: '第4集 摘要', done: false },
        { title: '第5集 推理', done: false },
        { title: '第6集 转换', done: false },
        { title: '第7集 扩展', done: false },
        { title: '第8集 聊天机器人', done: false },
        { title: '第9集 总结', done: false },
      ],
    },
    {
      title: '微软官方Prompt Engineering指南',
      description: 'Microsoft Learn官方文档，系统学习Azure OpenAI提示工程最佳实践',
      url: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/prompt-engineering',
      platform: 'other',
      tags: ['Prompt', '微软', '官方文档'],
      notes: '官方最佳实践：明确指令 → 提供上下文 → 分割任务 → 使用示例 → 指定输出格式',
      chapters: [
        { title: 'Prompt Engineering基础', done: false },
        { title: '最佳实践与技巧', done: false },
        { title: '系统消息设计', done: false },
        { title: 'Few-shot示例', done: false },
      ],
    },
    {
      title: 'LangChain LLM应用开发课程',
      description: 'DeepLearning.AI免费课程，用LangChain构建LLM应用实战',
      url: 'https://www.deeplearning.ai/short-courses/langchain-for-llm-application-development/',
      platform: 'other',
      tags: ['LangChain', 'LLM', '免费课程'],
      notes: 'Models → Prompts → Output Parsers → Memory → Chains → Q&A → Agents',
      chapters: [
        { title: 'Models, Prompts and Parsers', done: false },
        { title: 'Memory 记忆机制', done: false },
        { title: 'Chains 链式调用', done: false },
        { title: 'Q&A with Documents', done: false },
        { title: 'Evaluation 评估', done: false },
        { title: 'Agents 智能代理', done: false },
      ],
    },
  ],
  english: [
    {
      title: '艾宾浩斯记忆法背单词',
      description: '科学记忆曲线，高效背诵四六级/考研词汇',
      url: '',
      platform: 'other',
      tags: ['单词'],
      notes: '5分钟→30分钟→12小时→1天→2天→4天→7天→15天',
      chapters: [
        { title: '记忆曲线原理', done: true },
        { title: '第一天：列表记忆', done: true },
        { title: '第二天：复习+新词', done: false },
        { title: '第七天：周复习', done: false },
      ],
    },
    {
      title: 'BBC 6 Minute English精听',
      description: '每天6分钟，提升英语听力',
      url: 'https://www.bilibili.com/video/BV1BBC',
      platform: 'bilibili',
      tags: ['听力', '外刊'],
      notes: '第一遍盲听 → 第二遍看字幕 → 第三遍跟读',
      chapters: [],
    },
    {
      title: '影子跟读法练口语',
      description: '像影子一样跟着原声读，快速提升口语流利度',
      url: 'https://www.douyin.com/video/7890',
      platform: 'douyin',
      tags: ['口语'],
      notes: '选材2-3分钟 → 同步跟读 → 录音对比 → 重复',
      chapters: [
        { title: '选材与准备', done: false },
        { title: '同步跟读训练', done: false },
        { title: '录音对比纠音', done: false },
      ],
    },
    {
      title: 'BBC Learning English 官方网站',
      description: 'BBC官方英语学习平台，免费提供听力、口语、词汇、语法课程',
      url: 'https://www.bbc.co.uk/learningenglish/',
      platform: 'other',
      tags: ['听力', '口语', '免费资源'],
      notes: '6 Minute English → English at Work → The English We Speak → News Review → LingoHack',
      chapters: [
        { title: '6 Minute English 每日6分钟', done: false },
        { title: 'English at Work 职场英语', done: false },
        { title: 'The English We Speak 地道表达', done: false },
        { title: 'News Review 新闻词汇', done: false },
      ],
    },
    {
      title: 'TED Talks 官方网站',
      description: '全球最优质的英文演讲平台，练听力+学表达+开拓视野三合一',
      url: 'https://www.ted.com/talks',
      platform: 'other',
      tags: ['听力', '口语', '演讲'],
      notes: '选5-15分钟演讲 → 关字幕听第一遍 → 开英文字幕听第二遍 → 跟读模仿 → 记录金句',
      chapters: [
        { title: '选择适合的演讲', done: false },
        { title: '无字幕盲听', done: false },
        { title: '英文字幕精听', done: false },
        { title: '跟读与金句记录', done: false },
      ],
    },
    {
      title: 'Cambridge Dictionary 剑桥词典',
      description: '最权威的英英词典，查词义、看例句、听发音、学用法',
      url: 'https://dictionary.cambridge.org/',
      platform: 'other',
      tags: ['单词', '语法', '工具'],
      notes: '查词三步：看英英释义 → 读例句 → 听发音。比中英词典更能培养英语思维',
      chapters: [
        { title: '英英释义阅读', done: false },
        { title: '例句学习法', done: false },
        { title: '同义词辨析', done: false },
      ],
    },
    {
      title: 'TED-Ed 英语学习动画合集',
      description: 'B站高播放量TED-Ed动画合集，趣味学英语+涨知识',
      url: 'https://www.bilibili.com/opus/1140547987313786899',
      platform: 'bilibili',
      tags: ['听力', '动画'],
      notes: 'TED-Ed动画短小精悍，每集3-5分钟，语速适中，适合精听和跟读',
      chapters: [
        { title: '选集与精听', done: false },
        { title: '跟读模仿', done: false },
      ],
    },
  ],
  media: [
    {
      title: '抖音算法机制全解析',
      description: '理解推荐算法，让你的视频获得更多曝光',
      url: 'https://www.bilibili.com/video/BV1media',
      platform: 'bilibili',
      tags: ['短视频运营', '账号起号'],
      notes: '完播率 > 点赞 > 评论 > 转发 > 关注',
      chapters: [
        { title: '流量池机制', done: true },
        { title: '破播放量层级', done: false },
        { title: '标签与垂直度', done: false },
      ],
    },
    {
      title: '剪映转场技巧合集',
      description: '10种常用转场效果，让视频更流畅',
      url: 'https://www.douyin.com/video/jianying',
      platform: 'douyin',
      tags: ['剪辑'],
      notes: '运镜转场、遮罩转场、缩放转场、渐变转场',
      chapters: [
        { title: '基础转场', done: true },
        { title: '进阶：遮罩转场', done: false },
      ],
    },
    {
      title: '直播带货话术模板',
      description: '高转化直播话术，从留人到逼单全流程',
      url: '',
      platform: 'other',
      tags: ['带货', '账号起号'],
      notes: '留人话术 → 产品介绍 → 信任背书 → 逼单促单',
      chapters: [
        { title: '开场留人话术', done: false },
        { title: '产品卖点提炼', done: false },
        { title: '逼单与催单', done: false },
      ],
    },
    {
      title: '剪映专业版完整教程',
      description: '从零开始学剪映，涵盖剪辑、转场、特效、字幕、调色全流程',
      url: '',
      platform: 'other',
      tags: ['剪辑'],
      notes: '导入素材 → 粗剪 → 精剪 → 加转场 → 加字幕 → 调色 → 导出',
      chapters: [
        { title: '剪映基础操作', done: false },
        { title: '转场与特效', done: false },
        { title: '字幕与贴纸', done: false },
        { title: '调色与导出', done: false },
      ],
    },
    {
      title: '小红书爆款笔记选题方法论',
      description: '如何找到小红书爆款选题，从用户需求到内容策划完整流程',
      url: '',
      platform: 'other',
      tags: ['账号起号', '短视频运营'],
      notes: '搜索下拉词 → 竞品分析 → 痛点挖掘 → 差异化定位 → 选题日历',
      chapters: [
        { title: '搜索下拉词分析', done: false },
        { title: '竞品拆解方法', done: false },
        { title: '选题差异化', done: false },
      ],
    },
    {
      title: '短视频脚本万能公式',
      description: '3秒留人+痛点共鸣+解决方案+行动号召，套用即出脚本',
      url: '',
      platform: 'other',
      tags: ['剪辑', '账号起号'],
      notes: '钩子(3秒) → 痛点(5秒) → 方案(15秒) → 案例(10秒) → 号召(5秒)',
      chapters: [
        { title: '钩子开场写法', done: false },
        { title: '痛点共鸣设计', done: false },
        { title: '行动号召设计', done: false },
      ],
    },
    {
      title: '巨量算数——抖音数据分析工具',
      description: '抖音官方数据分析平台，查看热点、趋势、指数，辅助内容决策',
      url: 'https://trendinsight.oceanengine.com/',
      platform: 'other',
      tags: ['短视频运营', '工具'],
      notes: '热点榜 → 搜索指数 → 内容趋势 → 达人榜 → 行业洞察',
      chapters: [
        { title: '热点趋势分析', done: false },
        { title: '搜索指数查询', done: false },
      ],
    },
  ],
  office: [
    {
      title: 'Excel VLOOKUP函数详解',
      description: '职场必会函数，数据查找利器',
      url: 'https://www.bilibili.com/video/BV1excel',
      platform: 'bilibili',
      tags: ['Excel'],
      notes: '=VLOOKUP(查找值, 数据范围, 列号, 精确匹配)',
      chapters: [
        { title: '基础语法', done: true },
        { title: '模糊匹配应用', done: false },
        { title: '与IFERROR组合', done: false },
      ],
    },
    {
      title: 'PPT设计四原则',
      description: '对比、重复、对齐、亲密性，让PPT更专业',
      url: '',
      platform: 'other',
      tags: ['PPT'],
      notes: 'CRAP原则：Contrast, Repetition, Alignment, Proximity',
      chapters: [],
    },
    {
      title: 'B站最强Excel函数入门到精通（83集）',
      description: '从SUM到VLOOKUP，零基础手把手教学，涵盖所有常用函数',
      url: 'https://www.bilibili.com/video/BV1vuqJBBEov/',
      platform: 'bilibili',
      tags: ['Excel', '函数'],
      notes: 'VLOOKUP → INDEX+MATCH → SUMIFS → COUNTIFS → IF嵌套 → 文本函数 → 日期函数',
      chapters: [
        { title: '基础函数：SUM/AVERAGE', done: false },
        { title: '查找函数：VLOOKUP/INDEX', done: false },
        { title: '条件函数：IF/SUMIFS', done: false },
        { title: '文本函数：LEFT/RIGHT/MID', done: false },
      ],
    },
    {
      title: 'Excel保姆级系统教程（198集）',
      description: '清华大佬198集完整教程，从零基础到精通，7天掌握Excel',
      url: 'https://www.bilibili.com/video/BV1hJtjzQEzy/',
      platform: 'bilibili',
      tags: ['Excel', '系统教程'],
      notes: '基础操作 → 格式设置 → 函数公式 → 数据透视表 → 图表制作 → 宏与VBA',
      chapters: [
        { title: 'Excel基础操作', done: false },
        { title: '公式与函数', done: false },
        { title: '数据透视表', done: false },
        { title: '图表与可视化', done: false },
        { title: '宏与VBA入门', done: false },
      ],
    },
    {
      title: 'Word长文档排版技巧',
      description: '目录自动生成、多级编号、样式管理、页眉页脚设置',
      url: '',
      platform: 'other',
      tags: ['Word'],
      notes: '样式优先 → 多级列表关联样式 → 目录自动生成 → 分节设页眉页脚',
      chapters: [
        { title: '样式系统设置', done: false },
        { title: '多级编号与标题', done: false },
        { title: '自动目录生成', done: false },
        { title: '页眉页脚与分节', done: false },
      ],
    },
  ],
  finance: [
    {
      title: '小白理财第一课：4321法则',
      description: '家庭资产配置的黄金法则，40%投资·30%生活·20%储蓄·10%保险',
      url: 'https://www.bilibili.com/video/BV1finance1',
      platform: 'bilibili',
      tags: ['理财入门'],
      notes: '先存应急金（3-6个月生活费）→ 再配置保险 → 最后做投资',
      chapters: [
        { title: '什么是4321法则', done: true },
        { title: '应急金怎么存', done: false },
        { title: '保险配置原则', done: false },
        { title: '投资渠道选择', done: false },
      ],
    },
    {
      title: '基金定投实战指南',
      description: '从零开始学基金定投，沪深300+中证500组合策略',
      url: 'https://www.bilibili.com/video/BV1finance2',
      platform: 'bilibili',
      tags: ['基金定投'],
      notes: '定投核心：选宽基指数 → 固定金额 → 长期持有 → 止盈不止损',
      chapters: [
        { title: '什么是基金定投', done: true },
        { title: '指数基金怎么选', done: false },
        { title: '定投策略：微笑曲线', done: false },
      ],
    },
    {
      title: '股票入门：看懂K线图',
      description: '零基础学看K线，阳线阴线·均线·成交量基础',
      url: 'https://www.douyin.com/video/finance3',
      platform: 'douyin',
      tags: ['股票基础'],
      notes: 'K线四要素：开盘价、收盘价、最高价、最低价',
      chapters: [
        { title: 'K线基础认知', done: false },
        { title: '常见K线形态', done: false },
      ],
    },
    {
      title: '年轻人必备的保险清单',
      description: '重疾险+医疗险+意外险+寿险，用最少的钱买最大的保障',
      url: '',
      platform: 'other',
      tags: ['保险规划'],
      notes: '保额=年收入10倍，保费=年收入10%以内，先大人后小孩',
      chapters: [],
    },
    {
      title: '每周财经热点速览',
      description: '本周财经大事件解读，LPR降息对普通人有什么影响',
      url: 'https://www.douyin.com/video/finance5',
      platform: 'douyin',
      tags: ['财经资讯'],
      notes: 'LPR下降 → 房贷利率下降 → 月供减少 → 消费刺激',
      chapters: [],
    },
    {
      title: '中国投资者网（官方投教平台）',
      description: '证监会官方投资者教育平台，免费学习股票、基金、债券基础知识',
      url: 'https://www.investor.org.cn/',
      platform: 'other',
      tags: ['理财入门', '股票基础', '免费资源'],
      notes: '官方权威投教 → 防非防诈骗 → 投资知识百科 → 模拟交易练习',
      chapters: [
        { title: '投资入门第一课', done: false },
        { title: '股票基础知识', done: false },
        { title: '基金投资指南', done: false },
        { title: '防范金融诈骗', done: false },
      ],
    },
    {
      title: '且慢——基金定投策略平台',
      description: '盈米旗下基金投顾平台，提供定投策略和投资知识科普',
      url: 'https://qieman.com/',
      platform: 'other',
      tags: ['基金定投', '工具'],
      notes: '长牛计划 → 春华秋实 → 定投策略 → 资产配置 → 投资理念学习',
      chapters: [
        { title: '了解定投策略', done: false },
        { title: '资产配置理念', done: false },
      ],
    },
    {
      title: '雪球——投资者社区',
      description: '国内最活跃的投资社区，学习投资理念、跟踪持仓、看研报',
      url: 'https://xueqiu.com/',
      platform: 'other',
      tags: ['股票基础', '财经资讯', '社区'],
      notes: '关注优质投资者 → 学习投资逻辑 → 跟踪投资组合 → 读研报 → 别盲目跟风',
      chapters: [
        { title: '注册与关注大V', done: false },
        { title: '学习投资逻辑', done: false },
        { title: '跟踪投资组合', done: false },
      ],
    },
  ],
};

// 能量工作台默认金句
const QUOTE_SEED = [
  { content: '今天懒得动没关系，做一件让未来自己感谢你的小事就行。', source: '微小行动法', tags: ['motivation'], favorite: false },
  { content: '我正在用每一天的努力，换未来的自由。', source: '每日信念', tags: ['belief'], favorite: false },
  { content: '赚钱不丢人，没钱才焦虑。搞钱是最实在的安全感。', source: '搞钱信念墙', tags: ['belief'], favorite: false },
  { content: '行动是治愈焦虑最好的药。', source: '行动法则', tags: ['motivation'], favorite: false },
  { content: '把情绪写下来，就轻了一半。', source: '情绪管理', tags: ['mood'], favorite: false },
  { content: '不要等到完美才开始，开始了才会完美。', source: '行动哲学', tags: ['motivation'], favorite: false },
  { content: '你现在的状态，是过去选择的结果；你未来的状态，是现在选择的开始。', source: '因果法则', tags: ['belief'], favorite: false },
  { content: '比起做到100分，先做到1分更重要。', source: '微小行动法', tags: ['motivation'], favorite: false },
  { content: '允许自己偶尔摆烂，但别忘了回来。', source: '自我和解', tags: ['mood'], favorite: false },
  { content: '攒钱不是为了抠门，是为了有说「不」的底气。', source: '搞钱信念墙', tags: ['belief'], favorite: false },
];

// 重复模板种子数据
const TEMPLATE_SEED = [
  { title: '每日背单词', type: 'todo', repeatRule: 'daily', category: '学习', priority: 'medium', content: '每天30分钟单词记忆，使用艾宾浩斯记忆法' },
  { title: '每周例会', type: 'event', repeatRule: 'weekly', category: '工作', priority: 'high', content: '每周一上午10:00团队例会，汇报上周进展和本周计划' },
  { title: '每月社保办理', type: 'todo', repeatRule: 'monthly', category: '工作', priority: 'high', content: '每月1-15日办理员工社保公积金缴纳' },
  { title: '每日运动打卡', type: 'todo', repeatRule: 'daily', category: '生活', priority: 'low', content: '每天30分钟有氧运动' },
  { title: '每周复盘', type: 'todo', repeatRule: 'weekly', category: '通用', priority: 'medium', content: '每周日回顾本周完成情况，规划下周任务' },
  { title: '每月财务对账', type: 'todo', repeatRule: 'monthly', category: '工作', priority: 'high', content: '每月末核对收付款记录，整理票据' },
  { title: '每日阅读', type: 'todo', repeatRule: 'daily', category: '学习', priority: 'low', content: '每天至少阅读30分钟' },
  { title: '每周内容发布', type: 'todo', repeatRule: 'weekly', category: '工作', priority: 'medium', content: '每周发布2条短视频内容' },
];

// 灵感库种子数据
const INSPIRATION_SEED = [
  {
    url: 'https://www.bilibili.com/video/BV1GJ411x7h7',
    title: '【完整版】3分钟学会短视频脚本写作公式',
    platform: 'bilibili',
    author: '爆款研究所',
    cover: '',
    summary: '短视频脚本的黄金公式：钩子开场→痛点共鸣→解决方案→行动号召，附3个实操案例拆解',
    tags: ['B站', '文案', '运营', '干货'],
    notes: '这个公式可以直接套用到下周的产品推广视频上，钩子部分要用数据开场',
    favorite: true,
  },
  {
    url: 'https://www.douyin.com/video/7234567890123456',
    title: '抖音涨粉1000+的核心操作细节',
    platform: 'douyin',
    author: '运营老司机',
    cover: '',
    summary: '新手做抖音最容易忽略的5个细节：封面统一风格、前3秒钩子、评论区互动、发布时间、话题标签',
    tags: ['抖音', '运营', '起号', '干货'],
    notes: '封面统一风格这点我之前没注意，回去把已发的视频封面全部统一一下',
    favorite: false,
  },
  {
    url: 'https://www.xiaohongshu.com/explore/abc123def',
    title: '小红书爆款笔记排版技巧｜新手必看',
    platform: 'xhs',
    author: '设计小甜豆',
    cover: '',
    summary: '小红书笔记排版的6个关键点：标题emoji、段落空行、重点加粗、图片尺寸、话题标签、发布时间',
    tags: ['小红书', '文案', '干货'],
    notes: '标题加emoji这个技巧很实用，下次发笔记试试',
    favorite: false,
  },
  {
    url: 'https://www.bilibili.com/video/BV1x411Y7ZZ',
    title: 'JavaScript异步编程完全指南',
    platform: 'bilibili',
    author: '技术胖',
    cover: '',
    summary: '从回调函数到Promise到async/await，彻底搞懂JS异步编程，包含实战案例和常见坑点',
    tags: ['B站', '教程', '职场'],
    notes: 'async/await的错误处理部分讲得很清楚，用try-catch包裹 await 的写法要记住',
    favorite: true,
  },
  {
    url: 'https://www.douyin.com/video/7345678901234567',
    title: '1分钟学会手机拍美食｜不用打光也好看',
    platform: 'douyin',
    author: '手机摄影日记',
    cover: '',
    summary: '手机拍美食的3个角度：45度俯拍、平拍特写、顶拍全景，加上九宫格构图法',
    tags: ['抖音', '剪辑', '干货'],
    notes: '45度俯拍最适合中餐，下次拍探店视频用这个角度',
    favorite: false,
  },
  {
    url: 'https://www.xiaohongshu.com/explore/xyz789ghi',
    title: '职场穿搭｜通勤一周不重样搭配方案',
    platform: 'xhs',
    author: '穿搭日记本',
    cover: '',
    summary: '5套职场通勤穿搭：白衬衫+西裤、针织衫+半裙、西装外套+牛仔裤、连衣裙、风衣+阔腿裤',
    tags: ['小红书', '穿搭', '职场'],
    notes: '白衬衫+西裤的经典组合永不过时，买一件高质量白衬衫很值得',
    favorite: false,
  },
  {
    url: 'https://github.com/awesome-selfhosted/awesome-selfhosted',
    title: 'Awesome Self-Hosted - 开源自托管工具合集',
    platform: 'webpage',
    author: 'GitHub Community',
    cover: '',
    summary: '收集了大量可自托管的免费开源软件，涵盖笔记、项目管理、财务管理等多个领域',
    tags: ['收藏', '技术', '灵感'],
    notes: '里面的Memos和Joplin很适合做个人笔记管理，有空研究一下',
    favorite: false,
  },
  {
    url: 'https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/',
    title: '吴恩达 ChatGPT Prompt Engineering 免费课程',
    platform: 'webpage',
    author: 'DeepLearning.AI',
    cover: '',
    summary: '吴恩达与OpenAI联合出品的免费课程，1.5小时系统学习提示词工程，涵盖Prompt准则、迭代、摘要、推理、转换、扩展、聊天机器人',
    tags: ['收藏', 'AI', '免费课程', '灵感'],
    notes: '学完这个课程可以系统掌握Prompt写作技巧，对日常用AI帮助很大',
    favorite: true,
  },
  {
    url: 'https://www.bbc.co.uk/learningenglish/',
    title: 'BBC Learning English 官方英语学习平台',
    platform: 'webpage',
    author: 'BBC',
    cover: '',
    summary: 'BBC官方免费英语学习网站，包含6 Minute English、职场英语、地道表达、新闻词汇等系列课程',
    tags: ['收藏', '英语', '免费资源', '灵感'],
    notes: '每天6分钟英语，适合通勤路上听，碎片化学习利器',
    favorite: false,
  },
  {
    url: 'https://www.ted.com/talks',
    title: 'TED Talks - 全球最优质的演讲平台',
    platform: 'webpage',
    author: 'TED',
    cover: '',
    summary: '各行各业顶尖人才的演讲，涵盖科技、教育、心理、商业等领域，练听力+学表达+开拓视野',
    tags: ['收藏', '英语', '演讲', '灵感'],
    notes: '推荐先看带字幕的，选5-15分钟的演讲，精听+跟读+记金句',
    favorite: true,
  },
  {
    url: 'https://trendinsight.oceanengine.com/',
    title: '巨量算数 - 抖音官方数据分析平台',
    platform: 'webpage',
    author: '字节跳动',
    cover: '',
    summary: '抖音官方数据洞察工具，查看热点趋势、搜索指数、达人榜单、行业报告，辅助内容创作决策',
    tags: ['收藏', '新媒体', '工具', '灵感'],
    notes: '做抖音前先看巨量算数的热点榜，找到有流量缺口的内容方向再做',
    favorite: false,
  },
  {
    url: 'https://www.investor.org.cn/',
    title: '中国投资者网 - 证监会官方投教平台',
    platform: 'webpage',
    author: '中国证监会',
    cover: '',
    summary: '官方权威投资者教育平台，免费学习股票基金债券知识，防诈骗教育，投资知识百科',
    tags: ['收藏', '理财', '免费资源', '灵感'],
    notes: '理财入门先看官方投教，避免被各种割韭菜的课程忽悠',
    favorite: false,
  },
  {
    url: 'https://github.com/sindresorhus/awesome',
    title: 'Awesome - GitHub最全优质资源合集',
    platform: 'webpage',
    author: 'GitHub Community',
    cover: '',
    summary: 'GitHub上star最多的资源合集，涵盖编程、工具、学习资源、免费API等几乎所有领域',
    tags: ['收藏', '技术', '灵感'],
    notes: '遇到任何技术问题，先来Awesome列表找资源，比百度搜索靠谱多了',
    favorite: true,
  },
  {
    url: 'https://github.com/f/awesome-chatgpt-prompts',
    title: 'Awesome ChatGPT Prompts - 超全Prompt合集',
    platform: 'webpage',
    author: 'GitHub Community',
    cover: '',
    summary: '收录了200+个精选ChatGPT提示词模板，涵盖翻译、编程、写作、面试、营销等场景',
    tags: ['收藏', 'AI', 'Prompt', '灵感'],
    notes: '直接复制修改就能用，比自己从零写Prompt效率高10倍',
    favorite: true,
  },
];

// 感悟输出种子数据
const INSIGHT_SEED = [
  {
    title: '关于时间管理的三点思考',
    content: '今天读完了《深度工作》，有几点感悟很深：\n\n1. 忙碌不等于高效。很多时候我们只是在做"伪工作"——回邮件、开会、整理桌面，这些事看起来忙，但对核心目标毫无帮助。\n\n2. 深度工作需要仪式感。不是随时随地都能进入深度状态，需要固定的时间、固定的环境、明确的任务。\n\n3. 番茄工作法的本质不是"工作25分钟"，而是"排除一切干扰25分钟"。关掉通知、合上手机，这比任何时间管理工具都管用。\n\n下一步行动：每天上午9-11点设为深度工作时段，期间不回任何消息。',
    tags: ['时间管理', '读书', '深度工作'],
    mood: '🤔 思考',
    sourceType: 'general',
    outputType: 'essay',
    sourceTitle: '',
    sourceUrl: '',
  },
  {
    title: '副业思考：先把主业做到80分',
    content: '最近总想着做副业，但冷静下来想想：\n\n主业还没做到80分，就想着副业，本质上是逃避。主业上的能力积累、人脉资源、行业认知，这些都是副业的基础。\n\n与其花时间做低门槛的副业，不如把主业做到不可替代。当你在某个领域足够专业，变现的方式自然会来找你。\n\n结论：接下来3个月，聚焦主业能力提升，不再分散精力。',
    tags: ['职场', '副业', '成长'],
    mood: '😌 平静',
    sourceType: 'general',
    outputType: 'essay',
    sourceTitle: '',
    sourceUrl: '',
  },
  {
    title: '今天和客户的沟通让我学到一件事',
    content: '今天跟客户开会，对方提出了一个我完全没想到的需求。第一反应是"这做不到"，但我忍住了，改成了"我理解您的需求，让我回去评估一下方案"。\n\n结果回去仔细想，发现这个需求背后真正的痛点是XX，用另一种方式完全可以解决。\n\n感悟：\n1. 不要在情绪上头的时候做判断\n2. 客户要的不是"你的方案"，而是"解决他的问题"\n3. "我理解"比"我做不到"永远更好',
    tags: ['职场', '沟通', '客户'],
    mood: '😊 开心',
    sourceType: 'work',
    outputType: 'summary',
    sourceTitle: '客户沟通会议',
    sourceUrl: '',
  },
  {
    title: '存钱的本质是存选择权',
    content: '以前觉得存钱是为了安全感，现在发现存钱的本质是"存选择权"。\n\n有存款意味着：\n- 可以对不喜欢的工作说不\n- 可以在低谷期不焦虑\n- 可以抓住突然出现的机会\n- 可以生病时不用犹豫\n\n所以存钱不是抠门，是给自己买自由。每个月先存20%，剩下的才是可花的。',
    tags: ['理财', '成长', '感悟'],
    mood: '😌 平静',
    sourceType: 'learn_finance',
    outputType: 'essay',
    sourceTitle: '小白理财第一课：4321法则',
    sourceUrl: '',
  },
  {
    title: '学完吴恩达Prompt工程课的实战笔记',
    content: '花了2小时学完吴恩达的ChatGPT Prompt Engineering课程，整理了核心要点：\n\n1. **写Prompt的两个原则**：\n   - 写清晰具体的指令（不是"简短"而是"明确"）\n   - 给模型思考的时间（让AI分步推理）\n\n2. **迭代是关键**：\n   第一版Prompt几乎不会完美，要不断测试→分析→修改→再测试\n\n3. **实战技巧**：\n   - 用分隔符区分指令和内容（如```或###）\n   - 指定输出格式（JSON/表格/列表）\n   - 给Few-shot示例比解释更有效\n   - 让模型"先思考再回答"能减少幻觉\n\n4. **我的实践**：\n   用学到的技巧写了个自动生成周报的Prompt，效率提升了3倍！',
    tags: ['AI', 'ChatGPT', 'Prompt', '学习笔记'],
    mood: '😊 开心',
    sourceType: 'learn_ai',
    outputType: 'note',
    sourceTitle: '吴恩达 ChatGPT Prompt Engineering（免费课程）',
    sourceUrl: 'https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/',
  },
  {
    title: '用AI做了一个自动化工作台——实践作品',
    content: '学习了AI提示词工程和前端开发后，我做了一个个人效率工作台：\n\n**技术栈**：HTML + CSS + JavaScript + IndexedDB\n**功能模块**：\n- 日程待办管理（日历/看板/列表三视图）\n- 学习成长追踪（带视频链接和章节进度）\n- 理财台账（收支记录+资产配置）\n- 灵感库（一键收藏网页内容）\n- 感悟输出（关联学习来源）\n\n**核心收获**：\n1. 边学边做是最快的学习方式，比起看完教程再动手效率高10倍\n2. 用AI辅助写代码，从需求到上线只用了不到2周\n3. 做自己的工具，比用别人的产品更有掌控感\n\n**下一步**：加入AI对话功能，让工作台更智能',
    tags: ['AI', '前端开发', '实践作品', '工作台'],
    mood: '😊 开心',
    sourceType: 'learn_ai',
    outputType: 'work',
    sourceTitle: 'LangChain LLM应用开发课程',
    sourceUrl: 'https://www.deeplearning.ai/short-courses/langchain-for-llm-application-development/',
  },
  {
    title: 'TED演讲学习笔记：如何用30天改变自己',
    content: '看了Matt Cutts的TED演讲"Try something new for 30 days"，很有启发：\n\n**核心观点**：\n- 30天不多不少，刚好够养成一个新习惯\n- 从小事开始，比如每天拍一张照片\n- 30天后你会发现自己变了\n\n**我的30天挑战计划**：\n- 第1个30天：每天背30个单词\n- 第2个30天：每天写一段英文日记\n- 第3个30天：每天15分钟运动\n\n**感悟**：改变不需要惊天动地，从小事开始持续做，比一次性大改变更有效。',
    tags: ['TED', '英语', '习惯', '学习笔记'],
    mood: '🤔 思考',
    sourceType: 'learn_english',
    outputType: 'note',
    sourceTitle: 'TED演讲：如何用30天改变自己',
    sourceUrl: 'https://www.ted.com/talks',
  },
  {
    title: '短视频运营复盘：第一条破万播放的视频',
    content: '做了半个月抖音，终于有一条视频破万播放了！复盘一下做对了什么：\n\n1. **选题**：用了巨量算数查热点，发现"职场新人沟通"搜索量上升但内容供给不足\n2. **钩子**：前3秒用了一个数据冲击——"90%的职场新人都在犯这个错误"\n3. **结构**：痛点→原因→3个解决方案→行动号召\n4. **发布时间**：工作日晚上8点，目标用户最活跃\n\n**做错的**：\n- 封面太花哨，应该更简洁\n- 没有引导评论互动\n\n**下一步**：把这套方法论复制到下周的3条视频上，测试是否可复用。',
    tags: ['短视频运营', '抖音', '复盘', '实践作品'],
    mood: '😊 开心',
    sourceType: 'learn_media',
    outputType: 'summary',
    sourceTitle: '抖音算法机制全解析',
    sourceUrl: '',
  },
];

// 个人知识库种子数据
const KNOWLEDGE_SEED = [
  {
    title: '项目管理核心方法论',
    category: 'work',
    tags: ['项目管理', 'PMP', '方法论'],
    content: '## 项目管理五大过程组\n\n1. **启动过程组**：明确项目目标、识别干系人、制定项目章程\n2. **规划过程组**：制定项目管理计划、WBS分解、风险识别\n3. **执行过程组**：组建团队、质量保证、沟通管理\n4. **监控过程组**：跟踪进度、变更控制、绩效报告\n5. **收尾过程组**：项目验收、经验总结、归档\n\n## 常用工具\n- 甘特图：可视化项目进度\n- RACI矩阵：明确角色责任\n- 风险登记册：跟踪风险状态\n- 燃尽图：敏捷项目进度跟踪',
  },
  {
    title: '英语学习路线图｜从零到流利',
    category: 'study',
    tags: ['英语', '学习方法', '路线图'],
    content: '## 阶段一：基础搭建（词汇量3000+）\n- 每天背30个单词，用艾宾浩斯记忆法\n- 学完新概念2册，打好语法基础\n\n## 阶段二：输入积累（词汇量5000+）\n- 每天精听BBC 6 Minute English\n- 每周阅读2篇外刊文章（经济学人/卫报）\n\n## 阶段三：输出突破（词汇量8000+）\n- 影子跟读法练口语，每天15分钟\n- 找语言伙伴或用AI对话练口语\n- 尝试用英语写日记\n\n## 阶段四：实战应用\n- 看美剧不看字幕\n- 用英语做工作汇报\n- 考雅思/托福验证水平',
  },
  {
    title: 'CSS Flexbox 常用属性速查',
    category: 'tech',
    tags: ['CSS', 'Flexbox', '前端'],
    content: '## 容器属性\n```css\n.display { display: flex; }\n.direction { flex-direction: row | column; }\n.wrap { flex-wrap: nowrap | wrap; }\n.justify { justify-content: flex-start | center | flex-end | space-between | space-around; }\n.align { align-items: flex-start | center | flex-end | stretch; }\n```\n\n## 项目属性\n```css\n.flex-grow { flex-grow: 0 | 1; }       /* 放大比例 */\n.flex-shrink { flex-shrink: 0 | 1; }   /* 缩小比例 */\n.flex-basis { flex-basis: auto | 200px; } /* 基准尺寸 */\n.order { order: -1 | 0 | 1; }          /* 排列顺序 */\n.align-self { align-self: center; }    /* 单独对齐 */\n```\n\n## 常见布局\n- 居中：`justify-content: center; align-items: center;`\n- 两端对齐：`justify-content: space-between;`\n- 等分：`flex: 1;`',
  },
  {
    title: '家庭理财配置框架',
    category: 'life',
    tags: ['理财', '家庭', '配置'],
    content: '## 4321法则\n- 40%：投资理财（基金、股票、房产）\n- 30%：日常生活开支\n- 20%：储蓄备用（应急金3-6个月生活费）\n- 10%：保险保障（重疾+医疗+意外+寿险）\n\n## 应急金优先\n在任何投资之前，先存够3-6个月的生活费作为应急金，放在货币基金或活期。\n\n## 保险配置原则\n- 保额 = 年收入的10倍\n- 保费 = 年收入的10%以内\n- 先大人后小孩，先保障后理财',
  },
  {
    title: 'SEO优化核心要点',
    category: 'work',
    tags: ['SEO', '运营', '网站优化'],
    content: '## 站内优化\n- **TDK**：Title（标题）、Description（描述）、Keywords（关键词）\n- **URL结构**：简短、含关键词、用短横线分隔\n- **H标签**：H1唯一，H2-H3层级清晰\n- **内链**：相关页面互相链接\n- **图片Alt**：每张图片加alt属性\n\n## 站外优化\n- 外链建设：高质量、相关性强的外部链接\n- 社交信号：社交媒体分享和互动\n\n## 技术SEO\n- 页面加载速度 < 3秒\n- 移动端适配\n- HTTPS加密\n- XML Sitemap提交',
  },
  {
    title: 'JavaScript数组去重的6种方法',
    category: 'tech',
    tags: ['JavaScript', '数组', '前端'],
    content: '```javascript\n// 方法1：Set去重（推荐）\nconst unique1 = [...new Set(arr)];\n\n// 方法2：filter + indexOf\nconst unique2 = arr.filter((item, index) => arr.indexOf(item) === index);\n\n// 方法3：reduce + includes\nconst unique3 = arr.reduce((acc, cur) => {\n  if (!acc.includes(cur)) acc.push(cur);\n  return acc;\n}, []);\n\n// 方法4：Map去重\nconst unique4 = [...new Map(arr.map(item => [item, item])).values()];\n\n// 方法5：对象键去重\nconst unique5 = Object.keys(arr.reduce((obj, cur) => { obj[cur] = true; return obj; }, {}));\n\n// 方法6：双重for循环（性能最差，不推荐）\n```\n\n**推荐**：日常使用 Set 去重，简洁高效；对象数组用 Map 去重。',
  },
];

// 工作流种子数据
const WORKFLOW_SEED = [
  {
    title: '每日工作流程',
    category: 'daily',
    steps: [
      { text: '查看日历，确认今日会议和截止任务' },
      { text: '列出今日3件最重要的事（MIT）' },
      { text: '9:00-11:00 深度工作时段，处理最重要任务' },
      { text: '11:00-12:00 回复邮件和处理琐事' },
      { text: '14:00-15:00 午休后复盘上午进度' },
      { text: '15:00-17:00 会议和协作沟通' },
      { text: '17:00-17:30 整理今日成果，规划明日重点' },
    ],
  },
  {
    title: '项目启动流程',
    category: 'project',
    steps: [
      { text: '明确项目目标和范围，输出项目章程' },
      { text: '识别干系人，了解各方期望和需求' },
      { text: '制定WBS（工作分解结构），拆分任务' },
      { text: '估算工期和资源，制定项目计划' },
      { text: '识别风险，制定风险应对策略' },
      { text: '召开项目启动会，对齐团队认知' },
      { text: '建立项目跟踪机制（周报、看板）' },
    ],
  },
  {
    title: '月度报销流程',
    category: 'finance',
    steps: [
      { text: '收集本月所有票据（发票、收据、行程单）' },
      { text: '按类别分类：交通、餐饮、住宿、办公' },
      { text: '填写报销单，注明每笔费用的项目归属' },
      { text: '粘贴票据到报销单背面（按顺序排列）' },
      { text: '提交直属领导审批签字' },
      { text: '提交财务部门审核' },
      { text: '跟踪打款进度，确认到账' },
    ],
  },
  {
    title: '新员工入职流程',
    category: 'hr',
    steps: [
      { text: '入职前一天发送欢迎邮件，告知时间地点和所需材料' },
      { text: '第一天：办理入职登记，签订劳动合同' },
      { text: '第一天：领取办公设备，配置账号权限' },
      { text: '第一周：部门介绍，分配导师' },
      { text: '第一周：学习公司制度和流程文档' },
      { text: '第二周：开始参与实际项目任务' },
      { text: '第一个月末：入职面谈，了解适应情况' },
      { text: '第三个月：转正考核评估' },
    ],
  },
  {
    title: '短视频内容制作流程',
    category: 'other',
    steps: [
      { text: '选题：确定主题，调研同类爆款内容' },
      { text: '写脚本：钩子开场→内容主体→行动号召' },
      { text: '准备道具和拍摄场景' },
      { text: '拍摄：多角度拍摄，注意光线和收音' },
      { text: '剪辑：剪映/PR剪辑，加字幕和音乐' },
      { text: '封面设计：统一风格，突出标题' },
      { text: '发布：选择最佳发布时间，加话题标签' },
      { text: '复盘：24小时后查看数据，分析表现' },
    ],
  },
];

// 工作台账种子数据
const WORK_RECORD_SEED = {
  project: [
    { category: 'project', title: '企业官网改版项目', fields: { projectName: '企业官网改版项目', client: 'XX科技有限公司', status: '进行中', startDate: '2026-07-01', endDate: '2026-08-15', budget: '50000', manager: '张三', progress: '60', remark: '设计稿已确认，前端开发中' }, status: '进行中' },
    { category: 'project', title: '小程序商城开发', fields: { projectName: '小程序商城开发', client: 'YY商贸', status: '规划中', startDate: '2026-08-01', endDate: '2026-10-01', budget: '80000', manager: '李四', progress: '0', remark: '需求调研阶段' }, status: '规划中' },
  ],
  procurement: [
    { category: 'procurement', title: '办公电脑采购', fields: { itemName: 'MacBook Pro 14寸', type: '采购', supplier: '苹果授权经销商', quantity: '2', unit: '台', unitPrice: '14999', totalAmount: '29998', orderDate: '2026-07-15', status: '已签收', remark: '开发团队用机' }, status: '已签收' },
    { category: 'procurement', title: '办公用品月度采购', fields: { itemName: 'A4打印纸+笔+文件夹', type: '采购', supplier: '京东企业购', quantity: '1', unit: '批', unitPrice: '580', totalAmount: '580', orderDate: '2026-07-20', status: '已下单', remark: '月度办公用品补充' }, status: '已下单' },
  ],
  finance: [
    { category: 'finance', title: '官网改版-首付款', fields: { type: '收款', amount: '25000', counterparty: 'XX科技有限公司', category: '服务费', payDate: '2026-07-10', method: '银行转账', invoiceType: '增值税专票', invoiceNo: 'FP20260710001', status: '已支付', remark: '官网改版项目首付款50%' }, status: '已支付' },
    { category: 'finance', title: '7月房租', fields: { type: '付款', amount: '6000', counterparty: '房东王女士', category: '其他', payDate: '2026-07-01', method: '银行转账', invoiceType: '收据', invoiceNo: '', status: '已支付', remark: '7月办公室房租' }, status: '已支付' },
  ],
  hr: [
    { category: 'hr', title: '张三-社保公积金', fields: { employeeName: '张三', idNumber: '', itemType: '社保+公积金', baseAmount: '8000', companyPart: '2560', personalPart: '840', payMonth: '2026-07', status: '已缴纳', remark: '7月社保公积金' }, status: '已缴纳' },
    { category: 'hr', title: '李四-社保', fields: { employeeName: '李四', idNumber: '', itemType: '社保', baseAmount: '6000', companyPart: '1560', personalPart: '630', payMonth: '2026-07', status: '待缴纳', remark: '7月社保，需在15日前缴纳' }, status: '待缴纳' },
  ],
  info: [
    { category: 'info', title: '客户需求变更-官网增加多语言', fields: { title: '客户需求变更-官网增加多语言', fromParty: 'XX科技-王总', toParty: '技术部', channel: '微信', content: '客户要求官网增加中英文切换功能，预计增加3天工作量', receiveDate: '2026-07-25', deadline: '2026-07-28', status: '处理中', handler: '张三', remark: '需评估工作量后回复客户' }, status: '处理中' },
    { category: 'info', title: '供应商报价-云服务器续费', fields: { title: '供应商报价-云服务器续费', fromParty: '阿里云客服', toParty: '行政部', channel: '邮件', content: '阿里云服务器到期续费，年费从3600涨到4200', receiveDate: '2026-07-22', deadline: '2026-08-01', status: '已完成', handler: '李四', remark: '已续费，改为3年套餐享折扣' }, status: '已完成' },
  ],
};

// 生活记录种子数据
const LIFE_RECORD_SEED = {
  eat: [
    { category: 'eat', title: '早餐-全麦三明治', fields: { title: '早餐-全麦三明治', meal: '早餐', food: '全麦面包+鸡蛋+生菜+牛奶', calories: '380', remark: '简单健康' } },
    { category: 'eat', title: '午餐-鸡胸肉沙拉', fields: { title: '午餐-鸡胸肉沙拉', meal: '午餐', food: '鸡胸肉100g+生菜+番茄+糙米饭', calories: '520', remark: '减脂餐' } },
  ],
  fitness: [
    { category: 'fitness', title: '跑步30分钟', fields: { title: '跑步30分钟', exercise: '慢跑', duration: '30', calories: '280', remark: '公园慢跑，心率130-140' } },
    { category: 'fitness', title: '力量训练-上肢', fields: { title: '力量训练-上肢', exercise: '俯卧撑+哑铃推举', duration: '45', calories: '320', remark: '4组x12个' } },
    { category: 'fitness', title: '7月减脂记录', fields: { title: '7月减脂记录', recordDate: '2026-07-01', morningWeight: '68.5', eveningWeight: '69.0', bodyFat: '22', waist: '82', remark: '本月目标67kg，体脂20%' } },
    { category: 'fitness', title: '7月中复查', fields: { title: '7月中复查', recordDate: '2026-07-15', morningWeight: '67.8', eveningWeight: '68.3', bodyFat: '21', waist: '80', remark: '进展顺利，继续控制饮食' } },
  ],
  beauty: [
    { category: 'beauty', title: '日常护肤', fields: { title: '日常护肤', item: '基础护肤', product: '洗面奶+爽肤水+精华+面霜', remark: '早晚各一次' } },
    { category: 'beauty', title: '染发', fields: { title: '染发', item: '染发', product: '花泡泡染发剂-自然棕', remark: '自己在家染，效果不错' } },
  ],
  finance: [
    { category: 'finance', title: '7月工资', fields: { title: '7月工资', type: '收入', amount: '12000', category: '工资', remark: '7月工资到账' } },
    { category: 'finance', title: '基金定投', fields: { title: '基金定投', type: '投资', amount: '2000', category: '基金', remark: '每月定投沪深300指数基金' } },
    { category: 'finance', title: '日常开销', fields: { title: '日常开销', type: '支出', amount: '3500', category: '生活费', remark: '餐饮+交通+日用' } },
  ],
  travel: [
    { category: 'travel', title: '国庆日本旅行计划', fields: { title: '国庆日本旅行计划', destination: '大阪+京都', startDate: '2026-10-01', endDate: '2026-10-07', budget: '12000', remark: '机票已订，酒店待定' } },
  ],
  home: [
    { category: 'home', title: '收纳秘诀 - 留存道整理卞栎淳', fields: { title: '收纳秘诀 - 留存道整理卞栎淳', homeType: '软装收纳', tag: '🟢 红榜安利', platform: '抖音', price: '', url: 'https://www.douyin.com/video/7658202350615563546', remark: '价值117万元的收纳秘诀。衣帽间：合理设计柜体结构+植绒衣架+空间折叠技巧；卫生间：垂直空间利用+抽屉式收纳；书房：书籍分类+每种物品有"家"。核心思考：收纳设计要从"易维护"角度出发。⚠️植绒衣架对鼻炎家庭不友好，考虑木质/金属替代。' } },
    { category: 'home', title: '6个懒人卧室神器', fields: { title: '6个懒人卧室神器', homeType: '幸福感小物', tag: '🟢 红榜安利', platform: '抖音', price: '', url: 'https://www.douyin.com/video/7657418065713357044', remark: '衣柜多功能改造：化妆品薄柜+夹桌板架+镜子+DIY首饰盒+窗帘轨道挂项链+折叠穿衣镜+伸缩横杆收纳裤子。避坑：层板承重问题（已出现下弯），选加厚板材或金属支撑；柜门开合留够空间。' } },
    { category: 'home', title: '小户型厨房改造教科书（900万浏览）', fields: { title: '小户型厨房改造教科书（900万浏览）', homeType: '水电硬装', tag: '🟢 红榜安利', platform: '小红书', price: '', url: 'http://xhslink.com/o/FIlrWY4Ziu', remark: '砸墙实现客餐厨一体化，U型布局+双面高柜。双面高柜外侧放杯具干货，内侧嵌入微波炉蒸烤箱。高低错落层板适应不同尺寸。腰部以下5大抽屉+转角抽屉+165度大铰链柜门。动线：取-洗-切-炒-盛。避坑：高柜无门板需高频维护，建议加装玻璃门。' } },
    { category: 'home', title: '28个装修避坑要点（抠门老爸40年经验）', fields: { title: '28个装修避坑要点（抠门老爸40年经验）', homeType: '水电硬装', tag: '📌 待入手', platform: '抖音', price: '', url: 'https://www.douyin.com/video/7633359278078040202', remark: '水电：厨卫走顶/冰箱单独电路/4平方电线/超六类网线；水管：有地漏才做防水/开发商水管必换/选PPR禁PVC/包保温棉；瓷砖：先封阳台再贴砖/广东产性价比高/通铺不过门石/美缝优于填缝；厨房：台下盆/石英石台面/极简地轨门/燃气热水器优先；卫浴：回字形地漏/墙排优于地排/钛镁合金门；其他：换智能锁不换门/乳胶漆最环保/踢脚线与门同色/轻钢龙骨吊顶。' } },
    { category: 'home', title: '40㎡小户型空间利用教科书', fields: { title: '40㎡小户型空间利用教科书（二室一厅）', homeType: '看房买房', tag: '🟢 红榜安利', platform: '抖音', price: '', url: 'https://www.douyin.com/video/7641201879959303652', remark: '套内40㎡二室一厅。入户区：双鞋柜设计+嵌入式柜体与墙面齐平；客餐厨：沙发旁小吧台+吧台下抽拉家电柜+小餐厅留白；洗漱区：拱形门隔断+干湿分离+小次卧净衣区梳妆区；主卧：55寸电视+隐形晾衣架+衣柜与墙体齐平。核心：嵌入式柜体+留白+拱形门让视觉空间放大。' } },
    { category: 'home', title: '日本三分离卫生间设计', fields: { title: '日本三分离卫生间设计', homeType: '水电硬装', tag: '📌 待入手', platform: '抖音', price: '', url: 'https://www.douyin.com/video/7651932552474807571', remark: '洗手台+淋浴区+马桶间各自独立，三人可同时使用。整体浴室模块化设计，三面镜+高置物区+智能马桶。避坑：女性特殊时期三分离不便；每个独立空间局促有压迫感；整体浴室在中国造价较高；大户型没必要牺牲空间，二分离可能更实用。' } },
    { category: 'home', title: '买房贷款干货 - 等额本息提前还款', fields: { title: '买房贷款干货 - 等额本息提前还款', homeType: '看房买房', tag: '📌 待入手', platform: '抖音', price: '', url: 'https://www.douyin.com/video/7659704492182523146', remark: '等额本息贷款在第6-8年提前还款最划算。等额本息前期利息占比大，越早还省息越多；超过期限1/3后再还省息有限。等额本金vs等额本息：前者月供递减总利息少但前期压力大，后者月供固定适合年轻人。' } },
    { category: 'home', title: '装修拆旧回血攻略（可回收2000-3000元）', fields: { title: '装修拆旧回血攻略（可回收2000-3000元）', homeType: '水电硬装', tag: '🟢 红榜安利', platform: '抖音', price: '2400', url: 'https://www.douyin.com/video/7663172718045454042', remark: '拆旧不是扔垃圾！可回收变现：①电线铜芯最值钱（实测1000+）②门窗铝合金（1400元）③钢筋④栏杆护栏（1000+）。一套房拆旧可回血2000-3000元。⚠️关键：拆旧物归属权必须写进合同！明确约定拆除废品归业主所有，避免施工队私卖扯皮。新房国标电线可保留利用。' } },
  ],
  social: [
    { category: 'social', title: '红包 - 张三', fields: { subType: 'gift', direction: '送出', contactName: '张三', giftType: '红包', value: '500', relation: '朋友', scene: '生日', date: '2026-06-15', location: '微信转账', myFeeling: '开心', theirFeeling: '感谢', status: '', remark: '老张30岁生日，发了个红包' } },
    { category: 'social', title: '礼品 - 李四', fields: { subType: 'gift', direction: '收到', contactName: '李四', giftType: '礼品', value: '300', relation: '同事', scene: '节日', date: '2026-06-10', location: '公司', myFeeling: '惊喜', theirFeeling: '', status: '需要回礼', remark: '端午节收到李四送的粽子礼盒' } },
    { category: 'social', title: '红包 - 王五', fields: { subType: 'gift', direction: '送出', contactName: '王五', giftType: '红包', value: '1000', relation: '亲戚', scene: '婚礼', date: '2026-05-20', location: 'XX酒店', myFeeling: '祝福', theirFeeling: '感谢', status: '', remark: '表弟结婚，随了份子钱' } },
    { category: 'social', title: '伴手礼 - 赵六', fields: { subType: 'gift', direction: '送出', contactName: '赵六', giftType: '伴手礼', value: '200', relation: '邻居', scene: '乔迁', date: '2026-07-01', location: '小区', myFeeling: '友好', theirFeeling: '开心', status: '', remark: '邻居搬新家，送了套茶具' } },
    { category: 'social', title: '朋友生日聚餐', fields: { subType: 'gathering', title: '朋友生日聚餐', gatheringType: '朋友聚会', date: '2026-06-15', location: '海底捞XX店', peopleCount: '6', cost: '680', rating: '5', participants: '张三,李四,王五,赵六,小明', remark: '张三生日，氛围很好，服务员还唱了生日歌' } },
    { category: 'social', title: '部门季度团建', fields: { subType: 'gathering', title: '部门季度团建', gatheringType: '同事团建', date: '2026-07-10', location: 'XX轰趴馆', peopleCount: '15', cost: '3000', rating: '4', participants: '技术部全体', remark: '季度团建，玩了桌游和KTV，大家很放松' } },
    { category: 'social', title: '周末爬山活动', fields: { subType: 'activity', title: '周末爬山活动', activityType: '户外运动', activityDate: '2026-08-10', location: 'XX国家森林公园', organizer: '李四', cost: '150', status: '已确认', participants: '张三,李四,王五,赵六', remark: '早上8点在公园门口集合，带好水和零食' } },
    { category: 'social', title: '美术馆展览参观', fields: { subType: 'activity', title: '美术馆展览参观', activityType: '文化展览', activityDate: '2026-07-28', location: '市美术馆', organizer: '小明', cost: '0', status: '已结束', participants: '小明,小红', remark: '免费展览，印象派画展，值得一看' } },
  ],
};

// 播客种子数据
const PODCAST_SEED = [
  {
    title: '对话罗振宇：时间的朋友与长期主义',
    description: '关于时间管理、知识付费和个人成长的深度对话，探讨如何在信息爆炸时代保持专注',
    url: 'https://www.xiaoyuzhoufm.com/podcast/luo1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '对话',
    tags: ['成长', '认知', '时间管理'],
    notes: '长期主义不是坚持做一件事，而是坚持做正确的事。时间是朋友，不是敌人。',
    duration: '52分钟',
    checked: false,
  },
  {
    title: '奇葩说经典辩论：年轻人应该裸辞吗',
    description: '正反方激烈辩论裸辞的利弊，从职业规划、心理健康、经济压力多角度分析',
    url: 'https://www.bilibili.com/video/BV1debate1',
    platform: 'bilibili',
    cover: '',
    type: '辩论',
    tags: ['职场', '决策', '辩论'],
    notes: '裸辞不是冲动，是给自己按下暂停键重新思考方向。但前提是有3-6个月应急金。',
    duration: '38分钟',
    checked: false,
  },
  {
    title: '许知远对话李诞：人间不值得也得过',
    description: '知识分子与喜剧人的碰撞，聊理想主义与现实主义的平衡',
    url: 'https://www.xiaoyuzhoufm.com/podcast/xu1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '对话',
    tags: ['人生', '思考', '文化'],
    notes: '人间不值得不是说放弃，而是不要太较真。接受不完美，才能活得轻松。',
    duration: '65分钟',
    checked: true,
  },
  {
    title: '抖音热点辩论：AI会取代你的工作吗',
    description: '科技大佬与职场博主的交锋，AI时代普通人如何保持竞争力',
    url: 'https://www.douyin.com/video/ai1',
    platform: 'douyin',
    cover: '',
    type: '辩论',
    tags: ['AI', '职场', '未来'],
    notes: 'AI不会取代你，但会用AI的人会取代你。关键是学会与AI协作。',
    duration: '22分钟',
    checked: false,
  },
  {
    title: 'B站知识区对谈：如何构建个人知识体系',
    description: '三位知识博主的圆桌对话，从信息收集到知识输出的完整方法论',
    url: 'https://www.bilibili.com/video/BV1knowledge1',
    platform: 'bilibili',
    cover: '',
    type: '对话',
    tags: ['知识管理', '学习方法', '输出'],
    notes: '输入不等于知识，输出才是。最好的学习方式是教别人。',
    duration: '45分钟',
    checked: false,
  },
  {
    title: '小宇宙播客：搞钱女孩的副业经',
    description: '3位靠副业月入过万的女生分享真实经历，从0到1的副业起步指南',
    url: 'https://www.xiaoyuzhoufm.com/podcast/money1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '对话',
    tags: ['副业', '搞钱', '女性'],
    notes: '副业不是兼职，是用你的技能创造价值。先从自己擅长的事开始。',
    duration: '48分钟',
    checked: false,
  },
  {
    title: 'TED演讲：如何用30天改变自己',
    description: 'Google工程师Matt Cutts的经典演讲，用30天挑战尝试新事物',
    url: 'https://www.bilibili.com/video/BV1ted1',
    platform: 'bilibili',
    cover: '',
    type: '演讲',
    tags: ['习惯', '改变', '行动'],
    notes: '30天不大不小，刚好够养成一个新习惯。从小事开始，比如每天拍照记录生活。',
    duration: '4分钟',
    checked: true,
  },
  {
    title: '圆桌派：当代年轻人的焦虑从哪来',
    description: '窦文涛与嘉宾深度讨论年轻人焦虑的根源，社会比较与自我期待的双重重压',
    url: 'https://www.xiaoyuzhoufm.com/podcast/anxiety1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '对话',
    tags: ['心理', '焦虑', '社会'],
    notes: '焦虑的本质是「想要的太多，能做到的太少」。减少比较，专注当下。',
    duration: '55分钟',
    checked: false,
  },
  {
    title: '每日新闻早报：今日财经要闻速览',
    description: '盘点当日财经热点，涵盖股市、政策、行业动态，3分钟了解钱去哪了',
    url: 'https://www.xiaoyuzhoufm.com/podcast/news1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '新闻',
    tags: ['财经', '资讯', '每日'],
    notes: '信息差就是金钱差。每天花3分钟听财经新闻，慢慢就能看懂经济大趋势。',
    duration: '8分钟',
    checked: false,
  },
  {
    title: '抖音热榜新闻：本周社会热点盘点',
    description: '从热搜看社会百态，本周最值得关注的5条社会新闻深度解读',
    url: 'https://www.douyin.com/video/news1',
    platform: 'douyin',
    cover: '',
    type: '新闻',
    tags: ['社会', '热点', '资讯'],
    notes: '热搜不代表真相，但代表大众关注点。看新闻要带脑子，别被情绪带节奏。',
    duration: '12分钟',
    checked: false,
  },
  {
    title: '半佛仙人：普通人该不该买基金',
    description: '用最通俗的语言讲清楚基金定投的逻辑，适合理财小白入门',
    url: 'https://www.bilibili.com/video/BV1finance',
    platform: 'bilibili',
    cover: '',
    type: '财经',
    tags: ['理财', '基金', '投资'],
    notes: '定投核心：选宽基指数→固定金额→长期持有→止盈不止损。别追涨杀跌。',
    duration: '28分钟',
    checked: false,
  },
  {
    title: '硅谷101：AI时代普通人的机会在哪',
    description: '陈茜对话硅谷投资人，深度分析AI浪潮下普通人如何抓住机会、不被淘汰',
    url: 'https://www.xiaoyuzhoufm.com/podcast/sv101',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '对话',
    tags: ['AI', '科技', '投资'],
    notes: 'AI不会淘汰你，但不用AI的人会。关键是找到AI+你自己专业领域的交叉点。',
    duration: '62分钟',
    checked: false,
  },
  {
    title: '商业就是这样：解析本周商业大事件',
    description: '每周一更的商业评论播客，用通俗语言解读商业新闻背后的逻辑',
    url: 'https://www.xiaoyuzhoufm.com/podcast/biz1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '财经',
    tags: ['商业', '财经', '资讯'],
    notes: '看商业新闻不只看热闹，要看背后的供需逻辑和竞争格局。',
    duration: '45分钟',
    checked: false,
  },
  {
    title: '展开讲讲：当代年轻人为什么这么累',
    description: '从社会学到心理学，深度解析年轻人的职业倦怠和生活焦虑',
    url: 'https://www.xiaoyuzhoufm.com/podcast/expand1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '对话',
    tags: ['心理', '社会', '成长'],
    notes: '累不是你的错，是这个时代节奏太快。学会给自己按暂停键。',
    duration: '58分钟',
    checked: false,
  },
  {
    title: '疯投圈：投资人怎么看消费品牌',
    description: '专业投资人拆解消费品牌案例，从投资视角理解商业本质',
    url: 'https://www.xiaoyuzhoufm.com/podcast/crazy1',
    platform: 'xiaoyuzhou',
    cover: '',
    type: '财经',
    tags: ['投资', '商业', '消费'],
    notes: '看品牌不只看营销，更要看供应链、毛利、复购率这些硬指标。',
    duration: '50分钟',
    checked: false,
  },
  {
    title: 'B站知识区纪录片：互联网创业史',
    description: '从BAT到字节跳动，中国互联网20年创业史深度纪录片',
    url: 'https://www.bilibili.com/video/BV1doc1',
    platform: 'bilibili',
    cover: '',
    type: '纪录片',
    tags: ['创业', '互联网', '历史'],
    notes: '每个时代都有机会，关键是看到趋势并敢于行动。',
    duration: '90分钟',
    checked: false,
  },
];

// 初始化所有种子数据（仅首次使用时执行）
async function initSeedData() {
  try {
    // 初始化学习种子数据
    const learnCategories = ['expression', 'ai', 'english', 'media', 'office', 'finance'];
    for (const cat of learnCategories) {
      const existing = await getByCategory('learnings', cat);
      if (existing.length === 0 && LEARN_SEED[cat]) {
        for (const item of LEARN_SEED[cat]) {
          await add('learnings', { ...item, category: cat, checked: false });
        }
      }
    }

    // 初始化金句种子数据
    const quoteCount = await count('quotes');
    if (quoteCount === 0) {
      for (const q of QUOTE_SEED) {
        await add('quotes', q);
      }
    }

    // 初始化重复模板种子数据
    const templateCount = await count('repeatTemplates');
    if (templateCount === 0) {
      for (const t of TEMPLATE_SEED) {
        await add('repeatTemplates', t);
      }
    }

    // 初始化灵感库种子数据
    const inspirationCount = await count('inspirations');
    if (inspirationCount === 0) {
      for (const item of INSPIRATION_SEED) {
        await add('inspirations', item);
      }
    }

    // 初始化播客种子数据
    const podcastCount = await count('podcasts');
    if (podcastCount === 0) {
      for (const item of PODCAST_SEED) {
        await add('podcasts', item);
      }
    }

    // 初始化感悟输出种子数据
    const insightCount = await count('insights');
    if (insightCount === 0) {
      for (const item of INSIGHT_SEED) {
        await add('insights', item);
      }
    }

    // 初始化个人知识库种子数据
    const knowledgeCount = await count('knowledge');
    if (knowledgeCount === 0) {
      for (const item of KNOWLEDGE_SEED) {
        await add('knowledge', item);
      }
    }

    // 初始化工作流种子数据
    const workflowCount = await count('workflows');
    if (workflowCount === 0) {
      for (const item of WORKFLOW_SEED) {
        await add('workflows', item);
      }
    }

    // 初始化工作台账种子数据
    const workCategories = ['project', 'procurement', 'finance', 'hr', 'info'];
    for (const cat of workCategories) {
      const existing = await getByCategory('workRecords', cat);
      if (existing.length === 0 && WORK_RECORD_SEED[cat]) {
        for (const item of WORK_RECORD_SEED[cat]) {
          await add('workRecords', item);
        }
      }
    }

    // 初始化生活记录种子数据
    const lifeCategories = ['eat', 'fitness', 'beauty', 'finance', 'travel', 'home', 'social'];
    for (const cat of lifeCategories) {
      const existing = await getByCategory('lifeRecords', cat);
      if (existing.length === 0 && LIFE_RECORD_SEED[cat]) {
        for (const item of LIFE_RECORD_SEED[cat]) {
          await add('lifeRecords', item);
        }
      }
    }
  } catch (e) {
    console.error('种子数据初始化失败:', e);
  }
}

// === 设置存取 ===

async function getSetting(key, defaultValue = null) {
  const setting = await db.settings.get(key);
  return setting ? setting.value : defaultValue;
}

async function setSetting(key, value) {
  const now = new Date().toISOString();
  const existing = await db.settings.get(key);
  if (existing) {
    await db.settings.update(key, { value, updatedAt: now });
  } else {
    await db.settings.add({ key, value, updatedAt: now });
  }
}

// === GitHub Gist 云同步 ===

const GIST_FILENAME = 'shisi-cloud-backup.json';
const GIST_SETTING_KEY = 'gist_id';

// 云同步：上传加密数据到 GitHub Gist
async function cloudSync() {
  const token = await getSetting('github_token', '');
  if (!token) throw new Error('请先在设置页配置 GitHub Token');

  // 导出加密数据
  const encrypted = await exportAll();
  if (!encrypted) throw new Error('数据导出失败');

  const gistId = await getSetting(GIST_SETTING_KEY, '');

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    description: '诗思工作台云端备份',
    public: false,
    files: {
      [GIST_FILENAME]: {
        content: typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted),
      },
    },
  });

  let res;
  if (gistId) {
    // 更新已有 Gist
    res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH', headers, body,
    });
  } else {
    // 创建新 Gist
    res = await fetch('https://api.github.com/gists', {
      method: 'POST', headers, body,
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `同步失败 (${res.status})`);
  }

  const data = await res.json();
  if (!gistId && data.id) {
    await setSetting(GIST_SETTING_KEY, data.id);
  }

  await setSetting('last_cloud_sync', new Date().toISOString());
  return data.id || gistId;
}

// 从 Gist 恢复
async function cloudRestore() {
  const token = await getSetting('github_token', '');
  if (!token) throw new Error('请先在设置页配置 GitHub Token');

  const gistId = await getSetting(GIST_SETTING_KEY, '');
  if (!gistId) throw new Error('没有云端备份记录');

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
  });

  if (!res.ok) throw new Error(`获取备份失败 (${res.status})`);

  const data = await res.json();
  const file = data.files?.[GIST_FILENAME];
  if (!file || !file.content) throw new Error('云端备份为空');

  const backupData = JSON.parse(file.content);
  await importAll(backupData);
  return true;
}

// 检查云端是否有备份（用于首次打开时自动恢复）
async function cloudCheckExists() {
  const token = await getSetting('github_token', '');
  const gistId = await getSetting(GIST_SETTING_KEY, '');
  if (!token || !gistId) return false;

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// 获取上次同步信息
async function getCloudSyncInfo() {
  const token = await getSetting('github_token', '');
  const gistId = await getSetting(GIST_SETTING_KEY, '');
  const lastSync = await getSetting('last_cloud_sync', '');
  return {
    configured: !!token,
    hasGist: !!gistId,
    lastSync: lastSync ? new Date(lastSync).toLocaleString('zh-CN') : '从未同步',
  };
}

// 防抖云同步：数据变更后 30 秒自动上传
let _cloudSyncTimer = null;
function _autoCloudSync() {
  if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer);
  _cloudSyncTimer = setTimeout(async () => {
    _cloudSyncTimer = null;
    try {
      const token = await getSetting('github_token', '');
      if (!token) return; // 未配置 token，跳过
      await cloudSync();
      console.log('☁️ 自动云同步完成');
    } catch (e) {
      console.log('自动云同步失败:', e.message);
    }
  }, 30000);
}

export {
  db,
  add,
  bulkAdd,
  update,
  remove,
  get,
  getAll,
  query,
  getByCategory,
  clearTable,
  count,
  exportAll,
  importAll,
  exportToFile,
  importFromFile,
  listBackups,
  restoreBackup,
  cloudSync,
  cloudRestore,
  cloudCheckExists,
  getCloudSyncInfo,
  getSetting,
  setSetting,
  initSeedData,
};
