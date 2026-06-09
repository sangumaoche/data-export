# Data Export

基于 [Claude Code](https://claude.com/claude-code) 的智能数据导出助手。通过自然语言描述需求，自动从 MySQL 数据库查询数据并导出为结构化文件。

## 功能特性

- 🗣️ **自然语言交互** — 用中文描述数据需求，自动转化为精确 SQL
- 📊 **安全只读查询** — 仅限 SELECT，禁止写操作，敏感字段自动提醒
- 📁 **多格式导出** — 支持 CSV（UTF-8 BOM）、JSON、Excel 等格式
- 🧩 **分库分表感知** — 内置 ShardingSphere 分片规则，自动定位物理库表
- ✅ **样本预确认** — 大批量导出前先展示前 10 行，确认后再导出

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- MySQL 数据库只读账号
- [mcp-server-mysql](https://github.com/benborla/mcp-server-mysql)（MCP MySQL 服务）

### 安装步骤

1. **克隆项目**

   ```bash
   git clone https://github.com/sangumaoche/data-export
   cd data-export
   ```

2. **配置环境变量**

   ```bash
   cp .env.example .env
   ```

   编辑 `.env`，填入实际的数据库连接信息和 MCP Server 路径：

   ```env
   MCP_SERVER_HOME=/path/to/mcp-server-mysql

   MYSQL_HOST=192.168.1.100
   MYSQL_PORT=3306
   MYSQL_USER=readonly_user
   MYSQL_PASS=your_password

   ALLOW_INSERT_OPERATION=false
   ALLOW_UPDATE_OPERATION=false
   ALLOW_DELETE_OPERATION=false
   ```

3. **启动 Claude Code**

   ```bash
   claude
   ```

4. **开始使用**

   直接用自然语言描述你的数据需求，例如：

   > 查询 2026 年 6 月所有会员的消费记录，导出为 CSV

## 项目结构

```
data-export/
├── CLAUDE.md                          ← Agent 指令（工作流 & 规范定义）
├── .claude/rules/                     ← 分模块规则
│   ├── data-query.md                  ← [私有] SQL 编写 / 分片 / 安全规范
│   ├── data-query.example.md          ← ↑ 的示例模板
│   └── data-export.md                 ← 文件导出规范
├── .env.example                       ← 环境变量示例
├── .mcp.json                          ← MCP 服务配置
├── docs/
│   ├── sharding-rules.md              ← [私有] 分库分表完整规则
│   └── sharding-rules.example.md      ← ↑ 的示例模板
├── output/                            ← 导出文件存放目录
├── queries/                           ← SQL 脚本归档
│   └── SQL_INDEX.md                   ← 脚本索引
└── scripts/
    └── launch-mcp-mysql.js            ← MCP MySQL 启动脚本
```

> 标注 **[私有]** 的文件包含真实库名/表名等业务数据，已通过 `.gitignore` 排除，不会提交到 Git。
> 每个私有文件都有对应的 `.example.md` 模板供参考。

## 配置私有文件

本项目中的规则文件和配置涉及真实业务数据（数据库名、表名、连接信息等），不会提交到 Git。使用前需要从示例模板生成：

### 1. 环境变量

```bash
cp .env.example .env
# 编辑 .env，填入实际的数据库连接信息和 MCP Server 路径
```

### 2. 数据查询规则

```bash
cp .claude/rules/data-query.example.md .claude/rules/data-query.md
# 替换 <YOUR_DB_NAME> 等占位符为真实的业务库名
```

### 3. 分库分表规则

```bash
cp docs/sharding-rules.example.md docs/sharding-rules.md
# 替换 <your-db>、<your-db-2> 等占位符为真实的库名，补充实际的表清单
```

> 💡 **推荐做法**：使用 ShardingSphere 的配置 YAML 文件（如 `application-dev.yml`）自动生成分库分表规则文档，确保规则与线上配置一致，避免手动维护出错。

## 工作流程

```
自然语言需求 → 理解意图，确认库/表 → 查找可复用 SQL → 编写 SQL 供确认
     → 保存 SQL 脚本 → 预览样本数据（LIMIT 10）→ 确认后完整导出 → 输出到 ./output/
```

## 分库分表说明

本项目数据库使用 ShardingSphere 分库分表，MCP 直连 MySQL **不经过代理**，因此必须使用物理库表名。系统内置了四种分片模式的规则：

| 模式 | 库名规则 | 表名规则 |
|------|----------|----------|
| 按年月分库分表 | `{业务库}-{YYYY}` | `{表名}_{YYMM}` |
| 按会员 ID 分表 | `{业务库}`（主库） | `{表名}_{0..3}`（需 UNION ALL） |
| 按年分库不分表 | `{业务库}-{YYYY}` | `{表名}`（无后缀） |
| 不分库分表 | `{业务库}`（主库） | `{表名}`（无后缀） |

完整规则详见 [docs/sharding-rules.md](docs/sharding-rules.md)（需先从模板配置，见上方「配置私有文件」）。

## 安全约束

- 🚫 禁止执行写操作（INSERT / UPDATE / DELETE / DROP / ALTER）
- 🚫 禁止查询敏感字段（明文密码、密钥等）
- ✅ 大表查询强制加 `LIMIT`
- ✅ 多表 JOIN 前使用 `EXPLAIN` 检查执行计划
- ✅ 超过 10,000 行的结果会提醒并建议分批导出

## 技术栈

- **Agent 框架**: [Claude Code](https://claude.com/claude-code)（Anthropic Claude CLI）
- **数据库连接**: [mcp-server-mysql](https://github.com/mysqljs/mcp-server-mysql)（MCP 协议）
- **数据库**: MySQL（ShardingSphere 分库分表）

## License

Private — 内部使用
