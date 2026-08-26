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

-- ============================================================
-- 第二阶段：用户体系 + 单词本 + 抽查
-- ============================================================

-- B1. users —— 用户档案
--     role: 'admin' | 'teacher' | 'student'
CREATE TABLE IF NOT EXISTS koniponi.users (
    id           TEXT PRIMARY KEY,               -- '001', '002', ...
    student_id   TEXT UNIQUE NOT NULL,           -- 登录账号，如 'admin'
    password     TEXT NOT NULL,                  -- 目前明文
    role         TEXT NOT NULL DEFAULT 'student',
    name         TEXT NOT NULL,
    grade        TEXT,                           -- 大一/大二/大三/大四，teacher/admin 可空
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C1. favorites —— 单词本（收藏 + 错词合并，一个用户一个词只有一行）
--     fav_at   非空 = 手动收藏过
--     wrong_at 非空 = 答错过（值 = 最近一次错的时间）
--     两者均可独立为空/非空，均非空时前端展示两个 tag
CREATE TABLE IF NOT EXISTS koniponi.favorites (
    user_id      TEXT        NOT NULL REFERENCES koniponi.users(id) ON DELETE CASCADE,
    word_id      INTEGER     NOT NULL REFERENCES koniponi.words(id) ON DELETE CASCADE,
    fav_at       TIMESTAMPTZ,
    wrong_at     TIMESTAMPTZ,
    PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_fav_user ON koniponi.favorites(user_id);

-- C2. quiz_sessions —— 一次测试的表头
CREATE TABLE IF NOT EXISTS koniponi.quiz_sessions (
    id           SERIAL PRIMARY KEY,
    user_id      TEXT        NOT NULL REFERENCES koniponi.users(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    mode         TEXT        NOT NULL,           -- 'kanji2kana' | 'kana2kanji' | ...
    total        INTEGER     NOT NULL,
    correct      INTEGER     NOT NULL DEFAULT 0,
    finished     BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_qs_user_time ON koniponi.quiz_sessions(user_id, created_at DESC);

-- D1. quiz_answers —— 逐题答题日志
CREATE TABLE IF NOT EXISTS koniponi.quiz_answers (
    id             BIGSERIAL PRIMARY KEY,
    session_id     INTEGER     NOT NULL REFERENCES koniponi.quiz_sessions(id) ON DELETE CASCADE,
    user_id        TEXT        NOT NULL REFERENCES koniponi.users(id) ON DELETE CASCADE,
    word_id        INTEGER     NOT NULL REFERENCES koniponi.words(id) ON DELETE CASCADE,
    mode           TEXT        NOT NULL,
    user_answer    TEXT,                         -- 用户输入（可为空，代表未作答）
    correct_answer TEXT        NOT NULL,         -- 正确答案快照（出题时从 words 取出保存）
    is_correct     BOOLEAN     NOT NULL,
    answered_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qa_session    ON koniponi.quiz_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_user_word  ON koniponi.quiz_answers(user_id, word_id, answered_at DESC);
