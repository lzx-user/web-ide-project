/**
 * 接口：代码持久化保存
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 引用配置文件中的临时目录路径  退两层直达根目录下的 temp
const tempDir = path.join(__dirname, '../../temp');

router.post('/api/save', (req, res) => {
  const { roomId, code, filename } = req.body;
  if (!code) return res.status(400).json({ error: '内容不能为空' });

  // 引入沙箱概念：直达当前房间的专属目录
  const roomDir = path.join(tempDir, roomId);
  const filePath = path.join(roomDir, filename);

  try {
    // 自动探测并创建缺失的深层父级目录
    const dirName = path.dirname(filePath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    fs.writeFileSync(filePath, code, 'utf8');
    res.status(200).json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('保存失败:', error);
    res.status(500).json({ error: '文件系统写入失败' });
  }
});

module.exports = router;