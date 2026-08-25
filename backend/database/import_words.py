# -*- coding: utf-8 -*-
"""单词表导入（默认第三册）。--dry-run 只统计；不带则连库导入（按 source_file 重导）。"""
import os
import re
import csv
import glob
import sys
import argparse

# Windows 控制台中文输出兜底
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))   # backend/database

# 教材数据相对路径：database/ -> backend/ -> 产品我在这/ -> prototype0823/ -> now/单词表解析/第三册合计
DEFAULT_SOURCE_DIR = os.path.normpath(os.path.join(
    BASE_DIR, '..', '..', '..', '..', '单词表解析', '第三册合计'
))

FILE_RE = re.compile(r'^(?P<lesson>\d+)-U(?P<unit>\d+)-(?P<kind>新出|练习)')

ORIGIN_MAP = {'1': '普通', '2': '外来语'}


def load_env(path):
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


def strip_pos(raw):
    """词性去尖括号。"""
    raw = (raw or '').strip()
    if not raw:
        return None
    return raw.replace('<', '').replace('>', '').strip() or None


def parse_csv_file(path):
    """解析单个 CSV → (lesson, unit, kind, rows, stats)。"""
    fname = os.path.basename(path)
    m = FILE_RE.match(fname)
    if not m:
        return None, None, None, [], {'error': '文件名无法解析: %s' % fname}

    lesson = int(m.group('lesson'))
    unit = int(m.group('unit'))
    kind = m.group('kind')

    rows = []
    stats = {'empty_reading': 0, 'empty_accent': 0, 'empty_pos': 0,
             'empty_meaning': 0, 'origin_missing': 0, 'short_rows': 0}

    with open(path, encoding='utf-8-sig', newline='') as fh:
        for raw in csv.reader(fh):
            if not raw:
                continue
            # 表头：写法,读音,音调,品詞,意味,type
            if raw[0].strip() in ('写法', '単語'):
                continue
            if len(raw) < 6:
                stats['short_rows'] += 1
                continue

            writing = raw[0].strip()
            reading = raw[1].strip() or None
            accent = raw[2].strip() or None
            pos = strip_pos(raw[3])
            type_raw = raw[-1].strip()          # 最后一列：type（1=普通 2=外来语）→ word_type
            # 中间列（第5列及之后、直到倒数第二列）全是 meaning，可能含未转义逗号
            meaning = ';'.join(x.strip() for x in raw[4:-1]).strip() or None

            if type_raw in ORIGIN_MAP:
                origin = ORIGIN_MAP[type_raw]
            else:
                # type 列缺失/异常，默认「普通」并计数，供人工核对
                origin = '普通'
                stats['origin_missing'] += 1

            if not reading:
                stats['empty_reading'] += 1
            if not accent:
                stats['empty_accent'] += 1
            if not pos:
                stats['empty_pos'] += 1
            if not meaning:
                stats['empty_meaning'] += 1

            rows.append((lesson, unit, kind, origin, writing, reading,
                         accent, pos, meaning))

    return lesson, unit, kind, rows, stats


def collect(book, source_dir):
    files = sorted(glob.glob(os.path.join(source_dir, '*.csv')))
    all_rows = []
    total_stats = {'error': 0, 'files': len(files), 'empty_reading': 0,
                   'empty_accent': 0, 'empty_pos': 0, 'empty_meaning': 0,
                   'origin_missing': 0, 'short_rows': 0}
    origin_count = {}
    errors = []

    for path in files:
        fname = os.path.basename(path)
        lesson, unit, kind, rows, stats = parse_csv_file(path)
        if lesson is None:
            errors.append(stats['error'])
            total_stats['error'] += 1
            continue
        for k in ('empty_reading', 'empty_accent', 'empty_pos',
                  'empty_meaning', 'origin_missing', 'short_rows'):
            total_stats[k] += stats[k]
        for r in rows:
            origin_count[r[3]] = origin_count.get(r[3], 0) + 1
            all_rows.append((book, r[0], r[1], r[2], r[3], r[4], r[5],
                             r[6], r[7], r[8], fname))

    return files, all_rows, total_stats, origin_count, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--book', type=int, default=3, help='册号，默认 3')
    ap.add_argument('--source', default=DEFAULT_SOURCE_DIR, help='CSV 目录')
    ap.add_argument('--dry-run', action='store_true', help='只解析统计，不连库')
    args = ap.parse_args()

    print('数据目录:', args.source)
    files, all_rows, total_stats, origin_count, errors = collect(args.book, args.source)

    print('文件/行数:', total_stats['files'], '/', len(all_rows))
    print('普通/外来语:', origin_count)
    print('空值(读/音/词/义):', total_stats['empty_reading'], '/', total_stats['empty_accent'],
          '/', total_stats['empty_pos'], '/', total_stats['empty_meaning'])
    if errors:
        print('解析错误:', errors)

    if args.dry_run:
        print('[dry-run] 未写入。')
        return

    env = load_env(os.path.join(BASE_DIR, '..', '.env'))
    required = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']
    missing = [k for k in required if not env.get(k)]
    if missing:
        print('缺少连接参数:', ', '.join(missing), '（填 backend/.env）')
        sys.exit(1)

    import psycopg2
    conn = psycopg2.connect(
        host=env['PGHOST'],
        port=env['PGPORT'],
        dbname=env['PGDATABASE'],
        user=env['PGUSER'],
        password=env['PGPASSWORD'],
    )
    conn.autocommit = False
    cur = conn.cursor()

    try:
        schema_sql = os.path.join(BASE_DIR, 'schema.sql')   # 同目录
        with open(schema_sql, encoding='utf-8') as fh:
            cur.execute(fh.read())

        source_files = sorted({r[10] for r in all_rows})
        cur.execute(
            'DELETE FROM koniponi.words WHERE book = %s AND source_file = ANY(%s)',
            (args.book, source_files)
        )
        deleted = cur.rowcount

        insert_sql = '''
            INSERT INTO koniponi.words
                (book, lesson, unit, source_type, word_type, word, pronunciation,
                 accent, part_of_speech, meaning, source_file, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''

        prepared = []
        order_counter = {}
        for r in all_rows:
            fname = r[10]
            order_counter[fname] = order_counter.get(fname, 0) + 1
            prepared.append(r[:11] + (order_counter[fname] - 1,))

        cur.executemany(insert_sql, prepared)
        conn.commit()
        print('导入完成：删旧 %d，插入 %d。' % (deleted, len(prepared)))
        cur.execute('SELECT COUNT(*) FROM koniponi.words WHERE book = %s', (args.book,))
        print('第%d册当前总行数:' % args.book, cur.fetchone()[0])
    except Exception as e:
        conn.rollback()
        print('导入失败，已回滚:', e)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()
