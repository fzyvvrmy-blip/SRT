# SRT · KONIPONI

三个日专生 · 清华大学日语学习平台（学生端）

## 这是什么

一个「前端（静态网页）+ 后端（Python/Flask）+ PostgreSQL」的日语学习平台学生端。
前端是纯 HTML/CSS/JS，后端提供 API 并托管前端；数据存 PostgreSQL。

## 目录结构

```
产品我在这/
├─ frontend/                前端（静态页面，index.html 为入口）
│   ├─ index.html
│   ├─ app.js / extra.js
│   ├─ styles.css / extra.css
│   └─ assets/
└─ backend/                 Python 后端
    ├─ app.py               唯一入口：托管前端 + 提供 API
    ├─ config.py            数据库连接配置（读 .env）
    ├─ services/            业务函数（抽查随机等）
    │   └─ quiz.py
    ├─ database/            建表 SQL + 数据导入脚本
    │   ├─ schema.sql
    │   └─ import_words.py
    ├─ requirements.txt
    ├─ .env.example         连接信息模板（复制成 .env 后填）
    └─ .env                 你自己的真实连接信息（不进 git）
```

## 上手（三步）

```bash
# 1. 装依赖
pip install -r backend/requirements.txt

# 2. 配数据库连接
cp backend/.env.example backend/.env     # Windows: copy backend\.env.example backend\.env
#    然后编辑 backend/.env，填 PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD

# 3. 启动
cd backend
python app.py
```

浏览器打开 **http://127.0.0.1:5000/** 即可看到前端。
健康检查接口：**http://127.0.0.1:5000/api/health**（返回数据库里的单词总数）。

## 数据库

- schema 名：`koniponi`（单 schema 方案）。
- 核心表：`koniponi.words`（四册单词）。
- 建表/导入：
  ```bash
  cd backend/database
  python import_words.py --dry-run     # 先预演，只统计不写入
  python import_words.py               # 真正导入（按 source_file 重导，可重复跑）
  ```
- 单词 CSV 的原始数据默认在仓库外的 `now/单词表解析/`，组员一般**不需要**它——
  大家连同一个服务器数据库即可；只有需要重新灌库时才指定 `--source <CSV目录>`。

## 注意事项

- `.env`（含数据库密码）**不要提交**到 git，已在 `.gitignore` 忽略。
- 新增接口：在 `backend/app.py` 加路由；新增业务逻辑：在 `backend/services/` 加函数。
