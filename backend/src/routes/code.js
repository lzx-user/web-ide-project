/**
 * 接口：代码持久化保存
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 引用配置文件中的临时目录路径
const tempDir = path.join(__dirname, '../temp');

router.post('/api/save', (req, res) => {
  const { roomId, code, filename } = req.body;
  if (!code) return res.status(400).json({ error: '内容不能为空' });

  const filePath = path.join(tempDir, `${roomId}_${filename}`);
  try {
    fs.writeFileSync(filePath, code, 'utf8');
    res.status(200).json({ success: true, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ error: '文件系统写入失败' });
  }
});

module.exports = router;