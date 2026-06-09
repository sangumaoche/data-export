# 数据查询规范

## 数据库连接

- 通过 MCP 工具 `mcp_server_mysql` 访问 MySQL
- 账号为**只读权限**，仅支持 `SELECT`
- 采用 Multi-DB 模式，查询时必须带上库名前缀：`SELECT * FROM \`库名\`.表名`
- 常用业务库：`<YOUR_DB_NAME_1>`、`<YOUR_DB_NAME_2>`（查询前先确认库是否存在）

### ⚠️ MCP SQL 解析器限制

MCP MySQL 工具内置 SQL 解析器，**不支持以下语法**：

| ❌ 不支持 | ✅ 替代方案 |
|-----------|------------|
| `DESCRIBE \`库名\`.表名` | 查询 `information_schema.COLUMNS`（见下方模板） |
| `SHOW COLUMNS FROM \`库名\`.表名` | 同上 |

**查看表结构的推荐写法：**
```sql
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT, ORDINAL_POSITION
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '<YOUR_DB_NAME>' AND TABLE_NAME = '<YOUR_TABLE_NAME>'
ORDER BY ORDINAL_POSITION;
```

> 原因：解析器无法识别 `DESCRIBE` / `SHOW` 等语句中反引号标识符后的 `.` 跨库引用语法。
> 但 `SELECT ... FROM \`库名\`.表名` 这种标准 SELECT 语句中的跨库引用是正常的。

## ⚠️ 分库分表规则（必读）

本项目的数据库使用 **ShardingSphere** 做了分库分表，但 MCP 直连 MySQL **不经过 ShardingSphere 代理**。
因此编写 SQL 时**必须直接使用物理库名和物理表名**，不能用逻辑表名。

完整规则文档见：**`docs/sharding-rules.md`**

### 四种分片模式速查

| 模式 | 库名规则 | 表名规则 | 示例 |
|------|----------|----------|------|
| **A. 按年月分库分表** | `{业务库}-{YYYY}` | `{表名}_{YYMM}` | `` `<db>-2026`.`<table>_2606` `` |
| **B. 按会员ID分表** | `{业务库}`（主库） | `{表名}_{0..3}` | `` `<db>`.`<table>_0` `` （需 UNION ALL 全部4个分表） |
| **C. 按年分库不分表** | `{业务库}-{YYYY}` | `{表名}`（无后缀） | `` `<db>-2025`.`<table>` `` |
| **D. 不分库分表** | `{业务库}`（主库） | `{表名}`（无后缀） | `` `<db>`.`<table>` `` |

> 将 `<db>`、`<table>` 替换为你实际的业务库名和表名。

### 编写 SQL 前的检查清单

1. **确认逻辑表名属于哪个分片模式** → 查阅 `docs/sharding-rules.md` 中的表清单
2. **根据用户给的时间范围，确定物理库名**（如 `<db>-2025`）
3. **根据分片模式，确定物理表名**（年月后缀 or _0~_3 or 无后缀）
4. **模式 B 的表查询时必须 UNION ALL 全部 4 个分表**（_0, _1, _2, _3）
5. **跨库/跨表查询时使用 UNION ALL**
6. **不确定分片规则时，先查 information_schema 确认物理表**：
   ```sql
   SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_NAME LIKE '目标表名%' ORDER BY TABLE_SCHEMA, TABLE_NAME;
   ```

## 安全约束

- 🚫 **禁止执行任何写操作**（INSERT / UPDATE / DELETE / DROP / ALTER 等）
- 🚫 **禁止查询敏感字段**（如明文密码、密钥等），如发现此类字段应主动提醒用户
- ✅ 查询大表时必须加 `LIMIT`，避免全表扫描拖垮数据库
- ✅ 涉及多表 JOIN 时，先用 `EXPLAIN` 检查查询计划

