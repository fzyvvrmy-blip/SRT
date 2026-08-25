# -*- coding: utf-8 -*-
"""KONIPONI 后端入口：托管前端 + 提供 API。

运行：cd backend && python app.py
前端：http://127.0.0.1:5000/      API 健康检查：/api/health
"""
import os
from flask import Flask, jsonify, send_from_directory, request

import config
from services.kana import sort_kana, kana_str

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, '..', 'frontend'))

app = Flask(__name__, static_folder=None)


def get_conn():
    import psycopg2
    return psycopg2.connect(**config.db_config())


@app.route('/api/health')
def health():
    """连通性检查：能查到单词表数量即认为后端 + 数据库正常。"""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('SELECT count(*) FROM koniponi.words')
        n = cur.fetchone()[0]
        cur.close()
        conn.close()
        return jsonify({'ok': True, 'words': n})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/words')
def api_words():
    """单词查询：order=kana（假名表顺序）| book（课本顺序）；book 默认第三册。"""
    order = request.args.get('order', 'kana')
    book = request.args.get('book', 3, type=int)
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT word, pronunciation, accent, part_of_speech, meaning,
                      lesson, unit, source_type, word_type, sort_order
               FROM koniponi.words
               WHERE book = %s""",
            (book,),
        )
        words = [
            {
                'word': r[0], 'pron': r[1], 'accent': r[2], 'pos': r[3],
                'meaning': r[4], 'lesson': r[5], 'unit': r[6],
                'source_type': r[7], 'word_type': r[8],
                'kana': kana_str(r[0], r[1]),
            }
            for r in cur.fetchall()
        ]
    finally:
        cur.close()
        conn.close()

    if order == 'book':
        words.sort(key=lambda w: (w['lesson'] or 0, w['unit'] or 0))
    else:
        words = sort_kana(words)
    return jsonify({'order': order, 'book': book, 'total': len(words), 'words': words})


@app.route('/')
@app.route('/<path:path>')
def frontend(path='index.html'):
    """托管 ../frontend 下的静态文件。"""
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
