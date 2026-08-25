# -*- coding: utf-8 -*-
"""数据库连接配置：从 backend/.env 读取。"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env(path=os.path.join(BASE_DIR, '.env')):
    """读 .env 的 KEY=VALUE。"""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def db_config():
    env = load_env()
    return {
        'host': env.get('PGHOST', '127.0.0.1'),
        'port': env.get('PGPORT', '5432'),
        'dbname': env.get('PGDATABASE', 'koniponi'),
        'user': env.get('PGUSER', 'postgres'),
        'password': env.get('PGPASSWORD', ''),
    }
