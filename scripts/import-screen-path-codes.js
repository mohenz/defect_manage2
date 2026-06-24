const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MENU_LIST_PATH = path.join(ROOT_DIR, 'support', 'screen-paths', 'eclub_memuList.txt');
const SCREEN_PATH_GROUP = 'SCREEN_PATH';
const API_BASE_URL = (process.env.DEFECTFLOW_API_BASE_URL || 'http://127.0.0.1:3000/api').replace(/\/$/, '');

function normalizeSegment(segment = '') {
    return String(segment || '').replace(/\u3000/g, ' ').trim();
}

function normalizeScreenPath(line = '') {
    return String(line || '')
        .split('>')
        .map(normalizeSegment)
        .filter(Boolean)
        .join(' > ');
}

function buildScreenPathRecords(lines = []) {
    const records = [];
    const seen = new Set();

    lines.forEach((line) => {
        const normalized = normalizeScreenPath(line);
        if (!normalized || seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        records.push({
            group_code: SCREEN_PATH_GROUP,
            code_value: normalized,
            code_name: normalized,
            color: '#64748b',
            sort_order: records.length + 1,
            is_active: true
        });
    });

    return records;
}

async function request(pathname, options = {}) {
    const response = await fetch(`${API_BASE_URL}${pathname}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || response.statusText);
    }
    return payload;
}

async function syncScreenPathCodes() {
    const lines = fs.readFileSync(MENU_LIST_PATH, 'utf8').split(/\r?\n/);
    const records = buildScreenPathRecords(lines);

    if (records.length === 0) {
        console.log('[seed:screen-paths] 등록할 화면 경로가 없습니다.');
        return;
    }

    const existingRows = await request('/common-codes');
    const existingMap = new Map((existingRows || [])
        .filter((row) => row.group_code === SCREEN_PATH_GROUP)
        .map((row) => [row.code_value, row]));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
        const existing = existingMap.get(record.code_value);
        const needsUpdate = existing
            && (existing.code_name !== record.code_name || Number(existing.sort_order || 0) !== record.sort_order);

        if (existing && !needsUpdate) {
            skipped += 1;
            continue;
        }

        await request('/common-codes', {
            method: 'POST',
            body: JSON.stringify({
                ...record,
                originalKey: existing
                    ? { group_code: existing.group_code, code_value: existing.code_value }
                    : null
            })
        });

        if (existing) updated += 1;
        else inserted += 1;
    }

    console.log(`[seed:screen-paths] 완료: 총 ${records.length}건, 신규 ${inserted}건, 갱신 ${updated}건, 유지 ${skipped}건`);
}

syncScreenPathCodes().catch((error) => {
    console.error('[seed:screen-paths] 실패:', error.message);
    process.exitCode = 1;
});
