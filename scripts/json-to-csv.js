/**
 * 通用 JSON 查询结果 → CSV 转换器
 * 用法：node scripts/json-to-csv.js <输入JSON文件路径> <输出CSV文件路径>
 *
 * 输入格式：MCP MySQL 工具返回的 JSON 文件（数组套对象，或 [{text: "JSON字符串"}]）
 * 输出格式：UTF-8 with BOM 的 CSV 文件（Excel 直接打开不乱码）
 */

const fs = require('fs');
const path = require('path');

const [,, inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('用法: node json-to-csv.js <输入JSON文件> <输出CSV文件>');
  process.exit(1);
}

// 读取并解析输入
const raw = fs.readFileSync(inputPath, 'utf-8');
let parsed = JSON.parse(raw);

// 兼容 MCP 工具返回格式：[{type: "text", text: "[{...}, ...]"}]
if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
  parsed = JSON.parse(parsed[0].text);
}

if (!Array.isArray(parsed) || parsed.length === 0) {
  console.error('错误：输入数据为空或格式不正确');
  process.exit(1);
}

const rows = parsed;
const headers = Object.keys(rows[0]);

// 构建 CSV（带 BOM）
let csv = '﻿';
csv += headers.join(',') + '\n';

for (const row of rows) {
  const line = headers.map(h => {
    let val = row[h];
    if (val === null || val === undefined) val = '';
    val = String(val);
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      val = '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }).join(',');
  csv += line + '\n';
}

// 确保输出目录存在
const outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outputPath, csv, 'utf-8');
console.log(`✅ 转换完成: ${rows.length} 行 → ${outputPath}`);
