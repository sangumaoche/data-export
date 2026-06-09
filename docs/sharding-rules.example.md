# 分库分表规则说明

> 本文档基于 ShardingSphere YAML 配置整理，供数据导出 Agent 编写正确 SQL 参考。
> 配置文件来源：`docs/<your-service>-application-dev.yml`
> 最后更新：YYYY-MM-DD

---

## 核心概念

**MCP 直连 MySQL，不经过 ShardingSphere 代理**。因此 Agent 编写 SQL 时，**必须直接指定物理库名和物理表名**，不能用逻辑表名。

SQL 格式：`SELECT ... FROM \`库名\`.表名 WHERE ...`

---

## 物理库清单

### <your-db> 系列

| 物理库名 | 说明 |
|----------|------|
| `<your-db>` | 主库（当前数据，含按会员分表的 _0~_3 表） |
| `<your-db>-2020` | 2020年历史库 |
| `<your-db>-2021` | 2021年历史库 |
| `<your-db>-2022` | 2022年历史库 |
| `<your-db>-2023` | 2023年历史库 |
| `<your-db>-2024` | 2024年历史库 |
| `<your-db>-2025` | 2025年历史库 |
| `<your-db>-2026` | 2026年历史库 |

### <your-db-2> 系列

| 物理库名 | 说明 |
|----------|------|
| `<your-db-2>` | 主库（当前数据） |
| `<your-db-2>-2020` | 2020年历史库 |
| `<your-db-2>-2021` | 2021年历史库 |
| `<your-db-2>-2022` | 2022年历史库 |
| `<your-db-2>-2023` | 2023年历史库 |
| `<your-db-2>-2024` | 2024年历史库 |
| `<your-db-2>-2025` | 2025年历史库 |
| `<your-db-2>-2026` | 2026年历史库 |

---

## 四种分片模式

### 模式 A：按年月分库分表（toYearMonth）

**规则**：按 `created_time` 等时间字段路由到对应年库的月表。

- **库**：`{业务库}-{YYYY}`（如 `<your-db>-2026`）
- **表**：`{表名}_{YYMM}`（如 `t_buy_records_2606` 表示 2026年6月）
- **起始年**：各表不同，见下方清单

**SQL 编写要点**：
```sql
-- 查 2026年5月的购买记录 → 定位到 <your-db>-2026.t_buy_records_2605
SELECT * FROM `<your-db>-2026`.t_buy_records_2605
WHERE shopcode = 'xxx' LIMIT 10;

-- 查跨月数据（如 2026年1月~3月）→ UNION 多个月表
SELECT * FROM `<your-db>-2026`.t_buy_records_2601
UNION ALL
SELECT * FROM `<your-db>-2026`.t_buy_records_2602
UNION ALL
SELECT * FROM `<your-db>-2026`.t_buy_records_2603
WHERE shopcode = 'xxx';
```

### 模式 B：按会员 ID 分表（memid % 4）

**规则**：按 `memid` 取模 4 路由到不同分表，仅在主库中。

- **库**：`<your-db>`（不分库）
- **表**：`{表名}_{0..3}`（如 `t_card_0`、`t_card_1`、`t_card_2`、`t_card_3`）

**SQL 编写要点**：
```sql
-- ⚠️ 由于不知道 memid 在哪个分表，必须查所有4个表再 UNION
SELECT * FROM `<your-db>`.t_card_0 WHERE memid = 123
UNION ALL
SELECT * FROM `<your-db>`.t_card_1 WHERE memid = 123
UNION ALL
SELECT * FROM `<your-db>`.t_card_2 WHERE memid = 123
UNION ALL
SELECT * FROM `<your-db>`.t_card_3 WHERE memid = 123;

-- 如果按 shopcode 等非分片键查询，同样需要扫全部4个分表
SELECT * FROM `<your-db>`.t_card_0 WHERE shopcode = 'SHOP001'
UNION ALL
SELECT * FROM `<your-db>`.t_card_1 WHERE shopcode = 'SHOP001'
UNION ALL
SELECT * FROM `<your-db>`.t_card_2 WHERE shopcode = 'SHOP001'
UNION ALL
SELECT * FROM `<your-db>`.t_card_3 WHERE shopcode = 'SHOP001'
LIMIT 100;
```

### 模式 C：按年分库不分表（toYear）

**规则**：按时间字段路由到对应年库，但表名无后缀（每年库中只有一张完整表）。

- **库**：`{业务库}-{YYYY}`
- **表**：`{表名}`（无后缀，如 `t_complaint_info`）

**SQL 编写要点**：
```sql
-- 查 2025 年的回访投诉信息 → 定位到 <your-db>-2025.t_complaint_info
SELECT * FROM `<your-db>-2025`.t_complaint_info LIMIT 10;

-- 查跨年数据 → UNION 不同年库
SELECT * FROM `<your-db>-2024`.t_complaint_info
UNION ALL
SELECT * FROM `<your-db>-2025`.t_complaint_info
WHERE shopcode = 'xxx';
```

### 模式 D：不分库分表

**规则**：只在主库中，表名无后缀，直接查即可。

```sql
SELECT * FROM `<your-db>`.t_blacklist LIMIT 10;
```

---

## <your-db> 分片表清单

### 模式 A：按年月分库分表

| 逻辑表名 | 起始年 | 分片键（分库/分表） |
|----------|--------|---------------------|
| mem_buy_records | 2020 | created_time, id, billcode |


**特殊：t_redenvelope_records**（混合模式 A + B）
- 分库：按 created_time/id/billcode 路由到年库（toYearPart, 从2020起）
- 分表：按 memid % 4 分为 _0~_3
- SQL 示例：`SELECT * FROM \`<your-db>-2026\`.t_redenvelope_records_0 UNION ALL ...`

### 模式 B：按会员 ID 分表（memid % 4，仅主库）

| 逻辑表名 | 分片键 |
|----------|--------|
| mem_userinfo | id（complex 算法） |


### 模式 C：按年分库不分表

| 逻辑表名 | 起始年 | 分片键（分库） |
|----------|--------|----------------|
| mem_complaint_info | 2020 | created_time, id, billcode |

### 模式 D：不分库分表

| 逻辑表名 | 所在库 |
|----------|--------|
| mem_equity_var | `<your-db>` |


### 广播表（每个库都有一份）

| 逻辑表名 | 说明 |
|----------|------|
| mem_crv_shop_info | 回访门店信息，主库和各年库都有 |

---

## <your-db-2> 分片表清单

### 模式 A：按年月分库分表

| 逻辑表名 | 起始年 | 分片键（分库/分表） |
|----------|--------|---------------------|
| mem_card_member | 2020 | created_time, id, srid, billcode |


### 模式 C：按年分库不分表

| 逻辑表名 | 起始年 | 分片键（分库） |
|----------|--------|----------------|
| mem_package_adj_head | 2023 | created_time, id, billcode |


### 混合模式（按年分库 + 年月分库分表）

| 逻辑表名 | 年份 | 分片模式 | 分片键 |
|----------|------|----------|--------|
| mem_third_order | 2020~2025 | 模式 C（按年） | created_time, id, billcode（分库） |


> ⚠️ 注意：`t_third_order` 和 `t_third_records` 的分表方式在 2026 年发生了变化。
> 2020~2025 年：各年库中只有一张无后缀表（如 `<your-db-2>-2023`.t_third_order）
> 2026 年：按月分表（如 `<your-db-2>-2026`.t_third_order_2601）

---

## 快速查询模板

### 1. 查时间范围内的流水型数据（模式 A）

```sql
-- 需求：查 2025年3月 的服务消费记录
SELECT * FROM `<your-db-2>-2025`.t_service_records_2503
WHERE shopcode = 'xxx'
LIMIT 100;
```

### 2. 查会员相关数据（模式 B，需扫全部分表）

```sql
-- 需求：查某门店下所有会员卡
SELECT * FROM `<your-db>`.t_card_0 WHERE shopcode = 'SHOP001'
UNION ALL SELECT * FROM `<your-db>`.t_card_1 WHERE shopcode = 'SHOP001'
UNION ALL SELECT * FROM `<your-db>`.t_card_2 WHERE shopcode = 'SHOP001'
UNION ALL SELECT * FROM `<your-db>`.t_card_3 WHERE shopcode = 'SHOP001'
LIMIT 100;
```

### 3. 跨年查数据（模式 C）

```sql
-- 需求：查 2024~2025 年的投诉信息
SELECT * FROM `<your-db>-2024`.t_complaint_info WHERE shopcode = 'xxx'
UNION ALL
SELECT * FROM `<your-db>-2025`.t_complaint_info WHERE shopcode = 'xxx'
LIMIT 100;
```

### 4. 不确定分片规则时，先确认物理表

```sql
-- 先查 information_schema 确认某表在哪些库中有哪些分表
SELECT TABLE_SCHEMA, TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_NAME LIKE 't_buy_records%'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
```

---

## Agent 编写 SQL 的检查清单

1. **确认逻辑表名属于哪个分片模式**（查阅上方清单）
2. **根据用户给出的时间范围，确定物理库名**（`{业务库}-{YYYY}`）
3. **根据分片模式，确定物理表名**：
   - 模式 A（年月）：`{表名}_{YYMM}`
   - 模式 B（会员）：`{表名}_{0..3}`，需要 UNION ALL
   - 模式 C（按年）：`{表名}`（无后缀）
   - 模式 D（不分片）：`{表名}`（无后缀）
4. **跨库/跨表查询时使用 UNION ALL**
5. **不确定时，先查 `information_schema.TABLES` 确认物理表是否存在**
