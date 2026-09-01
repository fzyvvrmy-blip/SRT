# -*- coding: utf-8 -*-
"""KONIPONI 后端入口：托管前端 + 提供 API。

运行：cd backend && python app.py
前端：http://127.0.0.1:5000/      API 健康检查：/api/health
"""
import os
from flask import Flask, jsonify, send_from_directory, request, Response

import config
from services.kana import sort_kana, kana_str
from services.quiz import MODES, build_quiz, judge, mode_label

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, '..', 'frontend'))

app = Flask(__name__, static_folder=None)


def get_conn():
    import psycopg2
    return psycopg2.connect(**config.db_config())


# ── 健康检查 ─────────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('SELECT count(*) FROM koniponi.words')
        n = cur.fetchone()[0]
        cur.close(); conn.close()
        return jsonify({'ok': True, 'words': n})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


# ── 单词 ─────────────────────────────────────────────────────────────────────

@app.route('/api/words')
def api_words():
    """单词查询：order=kana | book；book 默认第三册。"""
    order = request.args.get('order', 'kana')
    book  = request.args.get('book', 3, type=int)
    conn  = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, word, pronunciation, accent, part_of_speech, meaning,
                      lesson, unit, source_type, word_type, sort_order
               FROM koniponi.words
               WHERE book = %s""",
            (book,),
        )
        words = [
            {
                'id': r[0], 'word': r[1], 'pron': r[2], 'accent': r[3],
                'pos': r[4], 'meaning': r[5], 'lesson': r[6], 'unit': r[7],
                'source_type': r[8], 'word_type': r[9],
                'kana': kana_str(r[1], r[2]),
            }
            for r in cur.fetchall()
        ]
    finally:
        cur.close(); conn.close()

    if order == 'book':
        words.sort(key=lambda w: (w['lesson'] or 0, w['unit'] or 0))
    else:
        words = sort_kana(words)
    return jsonify({'order': order, 'book': book, 'total': len(words), 'words': words})


# ── 收藏 ─────────────────────────────────────────────────────────────────────

@app.route('/api/favorites', methods=['GET'])
def favorites_get():
    """拉取用户单词本（可按 scope 过滤）。"""
    user_id = request.args.get('user_id', '')
    scope   = request.args.get('scope', 'all')   # 'fav' | 'wrong' | 'all'
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    scope_sql = {
        'fav':   'AND f.fav_at IS NOT NULL',
        'wrong': 'AND f.wrong_at IS NOT NULL',
        'all':   '',
    }.get(scope, '')

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT w.id, w.word, w.pronunciation, w.accent, w.part_of_speech,
                   w.meaning, w.lesson, w.unit, w.source_type, w.word_type,
                   f.fav_at, f.wrong_at
            FROM koniponi.favorites f
            JOIN koniponi.words w ON f.word_id = w.id
            WHERE f.user_id = %s {scope_sql}
            ORDER BY GREATEST(f.fav_at, f.wrong_at) DESC NULLS LAST
        """, (user_id,))
        rows = cur.fetchall()
    finally:
        cur.close(); conn.close()

    words = [{
        'id': r[0], 'word': r[1], 'pron': r[2], 'accent': r[3],
        'pos': r[4], 'meaning': r[5], 'lesson': r[6], 'unit': r[7],
        'source_type': r[8], 'word_type': r[9],
        'kana': kana_str(r[1], r[2]),
        'fav_at':   r[10].isoformat() if r[10] else None,
        'wrong_at': r[11].isoformat() if r[11] else None,
    } for r in rows]
    return jsonify({'words': words, 'total': len(words)})


@app.route('/api/favorites', methods=['POST'])
def favorites_post():
    """增删收藏。action: 'add' | 'remove'"""
    data    = request.get_json(force=True)
    user_id = data.get('user_id', '')
    word_id = data.get('word_id')
    action  = data.get('action', 'add')
    if not user_id or not word_id:
        return jsonify({'error': 'user_id and word_id required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        if action == 'add':
            cur.execute("""
                INSERT INTO koniponi.favorites (user_id, word_id, fav_at)
                VALUES (%s, %s, now())
                ON CONFLICT (user_id, word_id) DO UPDATE SET fav_at = now()
            """, (user_id, word_id))
        elif action == 'remove':
            cur.execute("""
                DELETE FROM koniponi.favorites
                WHERE user_id = %s AND word_id = %s
            """, (user_id, word_id))
        conn.commit()
    finally:
        cur.close(); conn.close()
    return jsonify({'ok': True})


# ── 题型列表 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/modes')
def quiz_modes():
    return jsonify([{'key': k, 'label': v['label']} for k, v in MODES.items()])


# ── 开始测试 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/start', methods=['POST'])
def quiz_start():
    """
    创建一次测试，返回题目列表。

    body JSON:
      user_id, name, mode,
      book (int, 课本册数，与 from/to 配合)  OR  scope ('fav'|'wrong'|'all')
      from_lesson, from_unit, to_lesson, to_unit  (book 非 null 时生效)
      qty (int | null，null = 全部)
    """
    d        = request.get_json(force=True)
    user_id  = d.get('user_id', '')
    name     = d.get('name', '').strip() or '未命名测试'
    mode     = d.get('mode', '')
    book     = d.get('book')          # None 表示我的单词本
    scope    = d.get('scope', 'all')
    from_l   = d.get('from_lesson')
    from_u   = d.get('from_unit')
    to_l     = d.get('to_lesson')
    to_u     = d.get('to_unit')
    qty      = d.get('qty')           # None = 全部

    if not user_id or mode not in MODES:
        return jsonify({'error': 'user_id and valid mode required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        questions = build_quiz(
            cur, user_id, mode,
            book=book,
            from_lesson=from_l, from_unit=from_u,
            to_lesson=to_l,     to_unit=to_u,
            scope=scope, qty=qty,
        )
        if not questions:
            cur.close(); conn.close()
            return jsonify({'error': '该范围内无可用词条'}), 404

        cur.execute("""
            INSERT INTO koniponi.quiz_sessions
              (user_id, name, mode, total, correct, finished)
            VALUES (%s, %s, %s, %s, 0, false)
            RETURNING id
        """, (user_id, name, mode, len(questions)))
        session_id = cur.fetchone()[0]
        conn.commit()
    finally:
        cur.close(); conn.close()

    return jsonify({
        'session_id': session_id,
        'total':      len(questions),
        'mode':       mode,
        'mode_label': mode_label(mode),
        'questions':  questions,
    })


# ── 提交测试 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/submit', methods=['POST'])
def quiz_submit():
    """
    提交整次测试答案，写 quiz_answers，更新 sessions，更新 favorites。

    body JSON:
      session_id, user_id,
      answers: [{word_id, mode, user_answer, correct_answer, is_correct}]
    """
    d          = request.get_json(force=True)
    session_id = d.get('session_id')
    user_id    = d.get('user_id', '')
    answers    = d.get('answers', [])

    if not session_id or not user_id:
        return jsonify({'error': 'session_id and user_id required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()

        # 验证 session 归属
        cur.execute("SELECT user_id FROM koniponi.quiz_sessions WHERE id = %s", (session_id,))
        row = cur.fetchone()
        if not row or row[0] != user_id:
            return jsonify({'error': 'session not found or not yours'}), 403

        correct_count = 0
        for ans in answers:
            # 以防前端漏传 is_correct，再判一次
            is_correct = bool(ans.get('is_correct'))
            if is_correct:
                correct_count += 1

            # 写答题日志
            cur.execute("""
                INSERT INTO koniponi.quiz_answers
                  (session_id, user_id, word_id, mode, user_answer, correct_answer, is_correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                session_id, user_id,
                ans['word_id'], ans['mode'],
                ans.get('user_answer', ''),
                ans['correct_answer'],
                is_correct,
            ))

            # 答错 → 写入 favorites.wrong_at（已收藏的不覆盖 fav_at）
            if not is_correct:
                cur.execute("""
                    INSERT INTO koniponi.favorites (user_id, word_id, wrong_at)
                    VALUES (%s, %s, now())
                    ON CONFLICT (user_id, word_id) DO UPDATE SET wrong_at = now()
                """, (user_id, ans['word_id']))

        # 结算 session
        cur.execute("""
            UPDATE koniponi.quiz_sessions
            SET correct = %s, finished = true, finished_at = now()
            WHERE id = %s
        """, (correct_count, session_id))

        conn.commit()
    finally:
        cur.close(); conn.close()

    total = len(answers)
    return jsonify({
        'ok':      True,
        'total':   total,
        'correct': correct_count,
        'score':   round(correct_count / total * 100) if total else 0,
    })


# ── 词数预览 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/count')
def quiz_count():
    """
    查询指定范围内可出题的词数（用于前端动态提示）。

    query params: user_id, mode, book?, from_lesson?, from_unit?, to_lesson?, to_unit?, scope?
    返回: {count: N}
    """
    user_id   = request.args.get('user_id', '')
    mode      = request.args.get('mode', '')
    book      = request.args.get('book', type=int)
    from_l    = request.args.get('from_lesson', type=int)
    from_u    = request.args.get('from_unit',   type=int)
    to_l      = request.args.get('to_lesson',   type=int)
    to_u      = request.args.get('to_unit',     type=int)
    scope     = request.args.get('scope', 'all')

    if not user_id or mode not in MODES:
        return jsonify({'error': 'user_id and valid mode required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        from services.quiz import build_quiz
        # 直接复用 build_quiz 逻辑但取全部词（qty=None），只返回长度
        questions = build_quiz(
            cur, user_id, mode,
            book=book,
            from_lesson=from_l, from_unit=from_u,
            to_lesson=to_l,     to_unit=to_u,
            scope=scope, qty=None,
        )
    finally:
        cur.close(); conn.close()

    return jsonify({'count': len(questions)})


# ── 判对覆盖 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/override', methods=['POST'])
def quiz_override():
    """
    将某道题手动标记为正确（"忽略"操作）。

    body JSON:
      session_id, user_id, word_id
        - 把 quiz_answers 里对应记录的 is_correct 改为 true
        - quiz_sessions.correct + 1
        - favorites: 若该词仅因答错（wrong_at 非空但 fav_at 为空）则清除整行；
                     若同时有 fav_at 则只清 wrong_at
    """
    d          = request.get_json(force=True)
    session_id = d.get('session_id')
    user_id    = d.get('user_id', '')
    word_id    = d.get('word_id')

    if not session_id or not user_id or not word_id:
        return jsonify({'error': 'session_id, user_id, word_id required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()

        # 验证 session 归属
        cur.execute("SELECT user_id FROM koniponi.quiz_sessions WHERE id = %s", (session_id,))
        row = cur.fetchone()
        if not row or row[0] != user_id:
            return jsonify({'error': 'session not found or not yours'}), 403

        # 确认这道题确实是答错的
        cur.execute("""
            SELECT id FROM koniponi.quiz_answers
            WHERE session_id = %s AND word_id = %s AND is_correct = false
        """, (session_id, word_id))
        ans_row = cur.fetchone()
        if not ans_row:
            return jsonify({'ok': True, 'msg': 'already correct or not found'})

        # 1. 更新答题记录
        cur.execute("""
            UPDATE koniponi.quiz_answers
            SET is_correct = true
            WHERE session_id = %s AND word_id = %s AND is_correct = false
        """, (session_id, word_id))

        # 2. 更新 session 得分
        cur.execute("""
            UPDATE koniponi.quiz_sessions
            SET correct = correct + 1
            WHERE id = %s
        """, (session_id,))

        # 3. 处理错词记录
        #    若 fav_at 也有值 → 只清 wrong_at（保留收藏）
        #    若 fav_at 为空 → 删整行（只因答错才进来的）
        cur.execute("""
            SELECT fav_at FROM koniponi.favorites
            WHERE user_id = %s AND word_id = %s
        """, (user_id, word_id))
        fav_row = cur.fetchone()
        if fav_row:
            if fav_row[0]:
                # 有手动收藏，只清错词时间
                cur.execute("""
                    UPDATE koniponi.favorites
                    SET wrong_at = NULL
                    WHERE user_id = %s AND word_id = %s
                """, (user_id, word_id))
            else:
                # 纯错词，删整行
                cur.execute("""
                    DELETE FROM koniponi.favorites
                    WHERE user_id = %s AND word_id = %s
                """, (user_id, word_id))

        conn.commit()
    finally:
        cur.close(); conn.close()

    return jsonify({'ok': True})


# ── 测试历史 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/history')
def quiz_history():
    user_id = request.args.get('user_id', '')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, mode, total, correct, finished, created_at, finished_at
            FROM koniponi.quiz_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 100
        """, (user_id,))
        rows = cur.fetchall()
    finally:
        cur.close(); conn.close()

    sessions = [{
        'id':          r[0],
        'name':        r[1],
        'mode':        r[2],
        'mode_label':  mode_label(r[2]),
        'total':       r[3],
        'correct':     r[4],
        'score':       round(r[4] / r[3] * 100) if r[3] else 0,
        'finished':    r[5],
        'created_at':  r[6].isoformat() if r[6] else None,
        'finished_at': r[7].isoformat() if r[7] else None,
    } for r in rows]
    return jsonify({'sessions': sessions})


# ── 测试详情 ──────────────────────────────────────────────────────────────────

@app.route('/api/quiz/session/<int:sid>')
def quiz_session(sid):
    user_id = request.args.get('user_id', '')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        # 表头
        cur.execute("""
            SELECT id, name, mode, total, correct, finished, created_at, finished_at
            FROM koniponi.quiz_sessions
            WHERE id = %s AND user_id = %s
        """, (sid, user_id))
        s = cur.fetchone()
        if not s:
            return jsonify({'error': 'not found'}), 404

        # 逐题明细
        cur.execute("""
            SELECT a.id, a.word_id, w.word, w.pronunciation, a.mode,
                   a.user_answer, a.correct_answer, a.is_correct, a.answered_at
            FROM koniponi.quiz_answers a
            JOIN koniponi.words w ON a.word_id = w.id
            WHERE a.session_id = %s
            ORDER BY a.id
        """, (sid,))
        answers = [{
            'id':             r[0],
            'word_id':        r[1],
            'word':           r[2],
            'pronunciation':  r[3],
            'mode':           r[4],
            'user_answer':    r[5],
            'correct_answer': r[6],
            'is_correct':     r[7],
            'answered_at':    r[8].isoformat() if r[8] else None,
        } for r in cur.fetchall()]
    finally:
        cur.close(); conn.close()

    return jsonify({
        'session': {
            'id':          s[0], 'name': s[1], 'mode': s[2],
            'mode_label':  mode_label(s[2]),
            'total':       s[3], 'correct': s[4],
            'score':       round(s[4] / s[3] * 100) if s[3] else 0,
            'finished':    s[5],
            'created_at':  s[6].isoformat() if s[6] else None,
            'finished_at': s[7].isoformat() if s[7] else None,
        },
        'answers': answers,
    })


# ── 精读 ─────────────────────────────────────────────────────────────────────

@app.route('/api/reading/lessons')
def reading_lessons():
    """返回有句子数据的 (book, lesson) 列表。"""
    book = request.args.get('book', type=int)
    conn = get_conn()
    try:
        cur = conn.cursor()
        if book:
            cur.execute("""
                SELECT DISTINCT book, lesson
                FROM koniponi.reading_sentences
                WHERE book = %s
                ORDER BY book, lesson
            """, (book,))
        else:
            cur.execute("""
                SELECT DISTINCT book, lesson
                FROM koniponi.reading_sentences
                ORDER BY book, lesson
            """)
        rows = cur.fetchall()
    finally:
        cur.close(); conn.close()
    return jsonify({'lessons': [{'book': r[0], 'lesson': r[1]} for r in rows]})


@app.route('/api/reading/sentences')
def reading_sentences():
    """
    返回某课的所有句子（含时间戳和文本）。
    query params: book, lesson
    """
    book   = request.args.get('book',   type=int)
    lesson = request.args.get('lesson', type=int)
    if not book or not lesson:
        return jsonify({'error': 'book and lesson required'}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, sentence, text, translation, start_time, end_time, source_file
            FROM koniponi.reading_sentences
            WHERE book = %s AND lesson = %s
            ORDER BY sentence
        """, (book, lesson))
        rows = cur.fetchall()
    finally:
        cur.close(); conn.close()

    sentences = [{
        'id':          r[0],
        'seq':         r[1],
        'text':        r[2] or '',
        'translation': r[3] or '',
        'start':       r[4],
        'end':         r[5],
        'source_file': r[6] or '',
    } for r in rows]
    return jsonify({'book': book, 'lesson': lesson, 'sentences': sentences})


@app.route('/api/audio/<path:filepath>')
def audio_proxy(filepath):
    """
    代理服务器上的音频文件（/home/Source/audio/...）给前端播放。
    filepath 示例: book_1/1-5-3.mp3
    支持 Range 请求，使浏览器能 seek。
    """
    audio_root = os.environ.get('AUDIO_ROOT', '/home/Source/audio').rstrip('/')
    full_path = f'{audio_root}/{filepath}'
    range_header = request.headers.get('Range', None)

    try:
        file_size = os.path.getsize(full_path)

        if range_header:
            byte_range = range_header.replace('bytes=', '').split('-')
            start = int(byte_range[0]) if byte_range[0] else 0
            end   = int(byte_range[1]) if byte_range[1] else file_size - 1
            end   = min(end, file_size - 1)
            length = end - start + 1
            with open(full_path, 'rb') as f:
                f.seek(start)
                data = f.read(length)
            resp = Response(data, 206, mimetype='audio/mpeg')
            resp.headers['Content-Range']  = f'bytes {start}-{end}/{file_size}'
            resp.headers['Accept-Ranges']  = 'bytes'
            resp.headers['Content-Length'] = str(length)
        else:
            with open(full_path, 'rb') as f:
                data = f.read()
            resp = Response(data, 200, mimetype='audio/mpeg')
            resp.headers['Accept-Ranges']  = 'bytes'
            resp.headers['Content-Length'] = str(file_size)

        resp.headers['Cache-Control'] = 'public, max-age=3600'
        return resp
    except FileNotFoundError:
        return jsonify({'error': f'audio file not found: {full_path}'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── 静态文件 ──────────────────────────────────────────────────────────────────

@app.route('/')
@app.route('/<path:path>')
def frontend(path='index.html'):
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
