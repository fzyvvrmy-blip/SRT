# -*- coding: utf-8 -*-
"""抽查（自测）业务：题型定义、抽词、判分。"""

import random

# ── 题型定义 ────────────────────────────────────────────────────────────────
# key         : 存入 DB 的标识符
# label       : 前端展示的中文名
# prompt_field: 出题时展示给用户的字段
# answer_field: 正确答案来自哪个字段
# word_type   : 限定词种（None = 不限；'普通' / '外来语'）
MODES = {
    'kanji2kana': {
        'label':        '看汉字　写假名',
        'prompt_field': 'word',
        'answer_field': 'pronunciation',
        'word_type':    '普通',
    },
    'kana2kanji': {
        'label':        '看假名　写汉字',
        'prompt_field': 'pronunciation',
        'answer_field': 'word',
        'word_type':    '普通',
    },
    'word2meaning': {
        'label':        '看单词　写释义',
        'prompt_field': 'word',
        'answer_field': 'meaning',
        'word_type':    '普通',
    },
    'word2accent': {
        'label':        '看单词　写音调',
        'prompt_field': 'word',
        'answer_field': 'accent',
        'word_type':    '普通',
    },
    'gairaigo_jp2cn': {
        'label':        '外来语（日译中）',
        'prompt_field': 'word',
        'answer_field': 'meaning',
        'word_type':    '外来语',
    },
    'gairaigo_cn2jp': {
        'label':        '外来语（中译日）',
        'prompt_field': 'meaning',
        'answer_field': 'word',
        'word_type':    '外来语',
    },
}

# 语气词词性关键字（含有这些字样的词性视为语气词，抽题时优先级降低）
_INTERJECTION_POS = ('感動詞', '終助詞', '間投詞', '感叹', '感动词', '终助词', '间投词')


def _is_interjection(pos):
    """判断词性是否为语气词类。"""
    if not pos:
        return False
    return any(k in pos for k in _INTERJECTION_POS)


def mode_label(mode_key):
    """mode key → 中文标签，找不到时原样返回。"""
    return MODES.get(mode_key, {}).get('label', mode_key)


# ── 抽词 ────────────────────────────────────────────────────────────────────

def build_quiz(cur, user_id, mode, book=None,
               from_lesson=None, from_unit=None,
               to_lesson=None,   to_unit=None,
               scope=None, qty=20):
    """
    从数据库抽词，返回题目列表。

    参数
    ----
    cur          : psycopg2 cursor（调用方负责事务）
    user_id      : 用户 id
    mode         : MODES 里的 key
    book         : 册数 1-4；None 时从 favorites 抽（scope 生效）
    from_lesson/unit, to_lesson/unit : 课本范围（book 非 None 时生效）
    scope        : 'fav' | 'wrong' | 'all'（book 为 None 时生效）
    qty          : 抽取数量；None / 0 表示全部

    返回
    ----
    list of dict:
        word_id, word, pronunciation, accent, meaning, word_type, part_of_speech,
        prompt   (出题展示内容),
        correct_answer (正确答案快照)
    """
    m = MODES.get(mode)
    if m is None:
        raise ValueError(f'未知 mode: {mode}')

    word_type_filter = m['word_type']
    answer_field     = m['answer_field']
    prompt_field     = m['prompt_field']

    # 音调模式排除含 '-' 的复合词标记（如 '0-1' '2-2'）
    # 用正则 ~ 而非 LIKE，避免 % 在 f-string + psycopg2 里被误解为参数占位符
    extra_filter = ''
    if mode == 'word2accent':
        extra_filter = "AND accent !~ '-'"
    # 出题字段和答案字段必须非空
    extra_filter += f" AND {prompt_field} IS NOT NULL AND {prompt_field} <> ''"
    extra_filter += f" AND {answer_field} IS NOT NULL AND {answer_field} <> ''"

    if book is not None:
        # ── 课本范围抽词 ──
        cur.execute(f"""
            SELECT id, word, pronunciation, accent, meaning, word_type, part_of_speech
            FROM koniponi.words
            WHERE book = %s
              AND (lesson * 100 + unit) >= %s
              AND (lesson * 100 + unit) <= %s
              AND (%s IS NULL OR word_type = %s)
              {extra_filter}
        """, (
            book,
            (from_lesson or 1) * 100 + (from_unit or 1),
            (to_lesson   or 99) * 100 + (to_unit  or 99),
            word_type_filter, word_type_filter,
        ))
    else:
        # ── 单词本范围抽词 ──
        if scope == 'fav':
            where_fav = "AND f.fav_at IS NOT NULL"
        elif scope == 'wrong':
            where_fav = "AND f.wrong_at IS NOT NULL"
        else:  # 'all'
            where_fav = ""

        # 用 w. 前缀替换字段引用
        extra_w = extra_filter.replace('accent', 'w.accent') \
                              .replace(f' {prompt_field}', f' w.{prompt_field}') \
                              .replace(f' {answer_field}', f' w.{answer_field}')

        cur.execute(f"""
            SELECT w.id, w.word, w.pronunciation, w.accent, w.meaning, w.word_type, w.part_of_speech
            FROM koniponi.favorites f
            JOIN koniponi.words w ON f.word_id = w.id
            WHERE f.user_id = %s
              {where_fav}
              AND (%s IS NULL OR w.word_type = %s)
              {extra_w}
        """, (user_id, word_type_filter, word_type_filter))

    rows = cur.fetchall()
    if not rows:
        return []

    col = ['id', 'word', 'pronunciation', 'accent', 'meaning', 'word_type', 'part_of_speech']
    words = [dict(zip(col, r)) for r in rows]

    # 语气词降优先级：分成两组分别打乱，优先出非语气词
    # 若 qty=None/0（全部），两组都完整保留
    normal_words = [w for w in words if not _is_interjection(w.get('part_of_speech'))]
    interj_words = [w for w in words if     _is_interjection(w.get('part_of_speech'))]
    random.shuffle(normal_words)
    random.shuffle(interj_words)

    ordered = normal_words + interj_words

    # 截取数量
    if qty and qty > 0:
        ordered = ordered[:qty]

    # 组装题目
    questions = []
    for w in ordered:
        prompt         = w.get(prompt_field) or ''
        correct_answer = w.get(answer_field) or ''
        if mode == 'word2accent':
            prompt = w['word']   # 题面只显示单词，读音由前端 quiz-sub 单独展示
        questions.append({
            'word_id':        w['id'],
            'word':           w['word'],
            'pronunciation':  w['pronunciation'],
            'accent':         w['accent'],
            'meaning':        w['meaning'],
            'word_type':      w['word_type'],
            'mode':           mode,
            'prompt':         prompt,
            'correct_answer': correct_answer,
        })
    return questions


# ── 判分 ────────────────────────────────────────────────────────────────────

def _normalize(s):
    """统一全半角、去首尾空白，便于宽松比较。"""
    if not s:
        return ''
    s = s.strip()
    # 全角 → 半角（数字 + 字母）
    result = []
    for c in s:
        code = ord(c)
        if 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        else:
            result.append(c)
    return ''.join(result)


def judge(mode, user_answer, correct_answer):
    """
    判分。返回 True / False。

    规则
    ----
    · 假名类（kanji2kana / kana2kanji）、外来语单词类（gairaigo_cn2jp）：
        严格全等（normalize 后）。
        若 correct_answer 含 '/'，拆分后任一匹配即可。

    · 音调类（word2accent）：
        含 '-' 的词已在 build_quiz 阶段过滤。
        若 correct_answer 含 '/'（如 '0/1'），拆分后任一匹配即可。

    · 释义类（word2meaning / gairaigo_jp2cn）：
        correct_answer 用 ';' 分隔多义项，用户答案须与某一完整义项完全相同。
        不接受子串匹配。
    """
    ua = _normalize(user_answer)
    if not ua:
        return False

    if mode in ('word2meaning', 'gairaigo_jp2cn'):
        # 释义：完整义项匹配
        options = [_normalize(x) for x in correct_answer.split(';') if x.strip()]
        return ua in options

    # 其余模式：严格全等，'/' 分隔时任一匹配即可
    options = [_normalize(x) for x in correct_answer.split('/') if x.strip()]
    return ua in options
