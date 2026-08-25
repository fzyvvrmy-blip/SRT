# SRT · KONIPONI

三个日专生 · 清华大学日语学习平台（学生端）

一个「前端（静态网页）+ 后端（Python/Flask）+ PostgreSQL」的日语学习平台学生端。
大家下载同一份代码、连同一个服务器数据库，就能在自己电脑上把网页跑起来。

---

## 一、目录结构

```
SRT/
├─ frontend/                前端（静态网页，index.html 是入口）
│   ├─ index.html
│   ├─ app.js / extra.js    页面逻辑
│   ├─ styles.css / extra.css
│   └─ assets/              图片素材
└─ backend/                 Python 后端（托管前端 + 提供 API）
    ├─ app.py               唯一入口
    ├─ config.py            读 .env 拿数据库连接信息
    ├─ services/            业务函数（假名排序、抽查等）
    ├─ database/            建表 SQL + 数据导入脚本
    ├─ requirements.txt     Python 依赖清单
    ├─ .env.example         连接信息模板（复制成 .env 后填）
    └─ .env                 你自己的连接信息（不进 git，见第四节）
```

---

## 二、怎么下载（第一次）

先装好两样东西：

1. **Python 3.8+**（建议 3.9~3.11），安装时勾选 **Add python.exe to PATH**。
2. **Git**（官网 git-scm.com 下载默认安装即可）。

然后打开终端（命令行），进到你放项目的文件夹，执行：

```bash
git clone https://github.com/fzyvvrmy-blip/SRT.git
cd SRT
```

> clone 不下来通常是没被加进仓库成员，找组长加一下协作者权限。

---

## 三、装依赖

在项目根目录（`SRT/`）执行：

```bash
pip install -r backend/requirements.txt
```

（就 Flask 和 psycopg2 两个包，装一遍即可。）

---

## 四、配置数据库连接（backend/.env）

网页数据存在一个**远程 PostgreSQL 服务器**里，大家连同一个库，所以只要填对连接信息，**不需要本地装数据库**。

1. 复制模板：

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```

2. 用记事本 / VSCode 打开 `backend/.env`，填 5 个字段：

```
PGHOST=8.130.188.157        # 数据库服务器地址（固定）
PGPORT=5432                 # 端口（固定）
PGDATABASE=koniponi         # 库名（固定）
PGUSER=koniponi             # 账号（固定）
PGPASSWORD=在这里填密码       # ← 密码，自己填
```

| 字段 | 含义 | 一般填什么 |
|------|------|-----------|
| PGHOST | 数据库服务器地址 | `8.130.188.157`（固定） |
| PGPORT | 端口 | `5432`（固定） |
| PGDATABASE | 库名 | `koniponi`（固定） |
| PGUSER | 数据库账号 | `koniponi`（固定） |
| PGPASSWORD | 数据库密码 | 自己填 |

> ⚠️ `PGPASSWORD` 是密码，**自己填，不要提交到 git**（以后上传时也一样）。
> `.env` 已被 `.gitignore` 忽略，正常 pull/push 都不会传上去，放心。

---

## 五、启动并查看

在 `backend/` 目录下执行：

```bash
python app.py
```

看到类似 `Running on http://127.0.0.1:5000/` 就成功了，浏览器打开：

👉 **http://127.0.0.1:5000/**

- 健康检查（确认后端 + 数据库都通了）：**http://127.0.0.1:5000/api/health**
  正常会返回 `{"ok": true, "words": <单词总数>}`。

---

## 六、每次新版本怎么同步

组长每次 push 新版本后，你只需在项目根目录（`SRT/`）执行：

```bash
git pull
```

拉到最新代码后，重新 `cd backend && python app.py` 启动即可。

> Git 是**追加历史、不是覆盖**：每次版本都还在。想看历史版本：
>
> ```bash
> git log --oneline              # 版本列表（每行一个提交，前面是版本哈希）
> git checkout <版本哈希>        # 切换到某个旧版本看代码
> git checkout main              # 再回到最新版
> ```

---

## 七、常见问题

- **`python app.py` 报 `ModuleNotFoundError: psycopg2`**：依赖没装，先 `pip install -r backend/requirements.txt`。
- **网页没数据 / 报数据库连不上**：检查 `backend/.env` 填对没、网络能不能连到服务器、`/api/health` 是否返回 `ok: true`。
- **端口 5000 被占用**：改 `backend/app.py` 最后一行的 `port=5000` 成别的（如 5001），再用 `http://127.0.0.1:5001/` 打开。
