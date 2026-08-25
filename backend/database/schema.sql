-- ============================================================
-- KONIPONI 数据库 schema（第一阶段：只建 words 表）
-- 单 schema 方案：全部表放 koniponi 命名空间下，靠表名与类别区分。
-- 类别：A 内容 / B 用户档案 / C 用户业务 / D 日志
-- ============================================================

-- 1. 创建 schema（幂等：已存在则忽略）
CREATE SCHEMA IF NOT EXISTS koniponi;

-- 2. words —— 四册单词（A 内容）
--    定位四列：book(册) / lesson(课) / unit(单元) / word_type(新出|练习)
--    对应前端「课本顺序」页签的四个下拉框。
CREATE TABLE IF NOT EXISTS koniponi.words (
    id              SERIAL PRIMARY KEY,          -- 无业务含义，自动递增
    book            SMALLINT     NOT NULL,       -- 第几册 1~4
    lesson          SMALLINT     NOT NULL,       -- 第几课
    unit            SMALLINT     NOT NULL,       -- 第几个 unit
    source_type     TEXT         NOT NULL,       -- '新出' | '练习'（来自文件名）
    word_type     TEXT         NOT NULL,       -- '普通' | '外来语'（来自 CSV 的 type 列：1/2）
    word            TEXT         NOT NULL,       -- 写法（汉字/片假名）
    pronunciation   TEXT,                        -- 读音（假名/罗马字），可空
    accent          TEXT,                        -- 音调：'3' / '0-0' / '2/0'，可空
    part_of_speech  TEXT,                        -- 词性（已去尖括号），可空
    meaning         TEXT,                        -- 中文释义，义项用 ';' 分隔
    sort_order      INTEGER      NOT NULL DEFAULT 0,  -- 课内原始出现顺序
    source_file     TEXT,                        -- 来源文件名，重导/去重用
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 3. 定位索引：按「课本顺序」拉一课/一 unit 时走索引
--    注意：不是唯一约束（同一位置允许重复出现，每出现一次存一行）
CREATE INDEX IF NOT EXISTS idx_words_locate
    ON koniponi.words (book, lesson, unit, source_type);
