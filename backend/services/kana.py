# -*- coding: utf-8 -*-
"""五十音图（假名表）排序：あいうえお… 浊音紧跟清音。"""

# 清音 + 浊音 + 半浊音，按五十音图顺序；浊音紧跟其清音行。
# 小写/拗音/促音/长音统一排到段尾（词中拗音因逐字符比较自然落到该行清音之后）。
_ORDER = (
    "あいうえお"
    "かきくけこがぎぐげご"
    "さしすせそざじずぜぞ"
    "たちつてとだぢづでど"
    "なにぬねの"
    "はひふへほばびぶべぼぱぴぷぺぽ"
    "まみむめも"
    "やゆよ"
    "らりるれろ"
    "わをん"
    "ぁぃぅぇぉゃゅょっー"
)
_WEIGHT = {c: i for i, c in enumerate(_ORDER)}
_MAX = len(_ORDER)


def _to_hira(s):
    """片假名按 Unicode 区块平移到平假名。"""
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in (s or ''))


def kana_str(word, pron):
    """排序用假名串：优先读音，读音不是假名（如外来语语源）时退回写法；片假名转平假名。
    前缀符号（〜 ～ ・ 等）跳过，取第一个假名字符起的串。"""
    def first_kana(s):
        """跳过非假名前缀，返回从第一个假名字符开始的子串。"""
        s = _to_hira(s or '')
        for i, c in enumerate(s):
            if c in _WEIGHT:
                return s[i:]
        return ''

    s = first_kana(pron)
    if not s:
        s = first_kana(word)
    return s


def kana_key(word, pron):
    """一个词的排序键（kana_str 加权重）。"""
    s = kana_str(word, pron)
    return (tuple(_WEIGHT.get(c, _MAX) for c in s), s)


def sort_kana(words):
    """按假名表顺序排序 list[dict]，dict 需含 word / pron 两键。"""
    return sorted(words, key=lambda w: kana_key(w.get('word'), w.get('pron')))
