const express = require('express');
const path = require('path');
const { Pool, types } = require('pg');

types.setTypeParser(20, value => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : value;
});

const app = express();
const PORT = Number(process.env.PORT || 3000);
const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 54323),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || undefined,
    database: process.env.PGDATABASE || 'defect_manage2'
});

app.use(express.json({ limit: '30mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

const staticRoot = __dirname;

function addParam(values, value) {
    values.push(value);
    return `$${values.length}`;
}

function pickBody(body, fields) {
    return fields.reduce((picked, field) => {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            picked[field] = body[field] === '' ? null : body[field];
        }
        return picked;
    }, {});
}

function parseList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeDefectId(value) {
    const text = String(value || '').trim();
    if (!/^\d+$/.test(text)) return null;
    return Number.parseInt(text, 10);
}

function parseScreenPath(screenPath = '') {
    const normalized = String(screenPath || '')
        .split('>')
        .map(part => part.replace(/\u3000/g, ' ').trim())
        .filter(Boolean);
    const screenName = normalized.pop() || '';
    return {
        menuName: normalized.join(' > '),
        screenName
    };
}

function applyDefectFilters(queryParams, where, values) {
    const defectId = normalizeDefectId(queryParams.defectId);
    if (defectId !== null) where.push(`defect_id = ${addParam(values, defectId)}`);
    if (queryParams.severity) where.push(`severity = ${addParam(values, queryParams.severity)}`);
    if (queryParams.status) where.push(`status = ${addParam(values, queryParams.status)}`);
    if (queryParams.title) where.push(`title ilike ${addParam(values, `%${queryParams.title}%`)}`);
    if (queryParams.stepsToRepro) where.push(`steps_to_repro ilike ${addParam(values, `%${queryParams.stepsToRepro}%`)}`);
    if (queryParams.testType) where.push(`test_type = ${addParam(values, queryParams.testType)}`);

    const enabledTestTypes = parseList(queryParams.enabledTestTypes);
    if (enabledTestTypes.length > 0) {
        where.push(`test_type = any(${addParam(values, enabledTestTypes)}::text[])`);
    }

    if (queryParams.statusPreset === '__NOT_COMPLETED__') {
        where.push(`status = any(${addParam(values, ['Open', 'In Progress', 'Reopened'])}::text[])`);
    }

    if (queryParams.identificationUnassigned === 'true' || queryParams.identificationUnassigned === true) {
        where.push(`(defect_identification is null or defect_identification = '')`);
    } else if (queryParams.identification) {
        where.push(`defect_identification = ${addParam(values, queryParams.identification)}`);
    }

    if (queryParams.screenPath) {
        const parsed = parseScreenPath(queryParams.screenPath);
        if (parsed.menuName) where.push(`menu_name = ${addParam(values, parsed.menuName)}`);
        if (parsed.screenName) where.push(`screen_name = ${addParam(values, parsed.screenName)}`);
    }

    if (queryParams.creator) where.push(`creator ilike ${addParam(values, `%${queryParams.creator}%`)}`);
    if (queryParams.assigneeUnassigned === 'true' || queryParams.assigneeUnassigned === true) {
        where.push(`(assignee is null or assignee = '')`);
    } else if (queryParams.assignee) {
        where.push(`assignee ilike ${addParam(values, `%${queryParams.assignee}%`)}`);
    }
    if (queryParams.dateStart) where.push(`created_at >= ${addParam(values, `${queryParams.dateStart}T00:00:00`)}`);
    if (queryParams.dateEnd) where.push(`created_at <= ${addParam(values, `${queryParams.dateEnd}T23:59:59`)}`);
}

async function queryRows(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

async function queryOne(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
}

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function buildInsert(table, payload) {
    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const columns = keys.map(key => `"${key}"`).join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    return {
        sql: `insert into ${table} (${columns}) values (${placeholders})`,
        values
    };
}

function buildUpdate(table, payload, idColumn, idValue) {
    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const setClause = keys.map((key, index) => `"${key}" = $${index + 1}`).join(', ');
    values.push(idValue);
    return {
        sql: `update ${table} set ${setClause} where ${idColumn} = $${values.length}`,
        values
    };
}

const DEFECT_SUMMARY_COLUMNS = 'defect_id, title, status, severity, defect_identification, test_type, creator, assignee';
const DEFECT_LIST_COLUMNS = 'defect_id, title, defect_identification, severity, priority, status, test_type, menu_name, screen_name, screen_url, steps_to_repro, env_info, creator, assignee, created_at, updated_at, action_comment, action_due_date, action_start, action_end';
const DEFECT_EXPORT_COLUMNS = 'defect_id, title, defect_identification, severity, priority, status, test_type, menu_name, screen_name, steps_to_repro, env_info, creator, assignee, created_at, updated_at, action_comment, action_due_date, action_start, action_end';
const DEFECT_FIELDS = [
    'defect_id', 'title', 'test_type', 'severity', 'priority', 'status', 'steps_to_repro',
    'menu_name', 'screen_name', 'screen_url', 'screenshot', 'defect_identification', 'env_info',
    'creator', 'assignee', 'action_comment', 'action_due_date', 'action_start', 'action_end',
    'is_deleted', 'created_at', 'updated_at'
];
const USER_FIELDS = [
    'user_id', 'email', 'password', 'name', 'department', 'role', 'status',
    'needs_password_reset', 'created_at', 'updated_at'
];

app.get('/api/health', asyncRoute(async (req, res) => {
    const row = await queryOne('select now() as now');
    res.json({ ok: true, database: pool.options.database, now: row.now });
}));

app.get('/api/defects/summary', asyncRoute(async (req, res) => {
    const rows = await queryRows(
        `select ${DEFECT_SUMMARY_COLUMNS} from public.defects where coalesce(is_deleted, 'N') = 'N' order by defect_id asc`
    );
    res.json(rows);
}));

app.get('/api/defects/export', asyncRoute(async (req, res) => {
    const where = [`coalesce(is_deleted, 'N') = 'N'`];
    const values = [];
    applyDefectFilters(req.query, where, values);
    const rows = await queryRows(
        `select ${DEFECT_EXPORT_COLUMNS} from public.defects where ${where.join(' and ')} order by created_at desc`,
        values
    );
    res.json(rows);
}));

app.get('/api/defects/action-recheck', asyncRoute(async (req, res) => {
    const rows = await queryRows(
        `select defect_id, assignee, status, defect_identification, action_comment
         from public.defects
         where coalesce(is_deleted, 'N') = 'N'
           and lower(status) = any($1::text[])
         order by defect_id desc`,
        [['closed', 'resolved', 'staging']]
    );
    res.json(rows
        .filter(row => !String(row.defect_identification || '').trim() && !String(row.action_comment || '').trim())
        .map(row => ({
            defect_id: row.defect_id,
            assignee: row.assignee || '',
            status: row.status || ''
        })));
}));

app.get('/api/defects/:id', asyncRoute(async (req, res) => {
    const row = await queryOne('select * from public.defects where defect_id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Defect not found' });
    res.json(row);
}));

app.get('/api/defects', asyncRoute(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const where = [`coalesce(is_deleted, 'N') = 'N'`];
    const values = [];
    applyDefectFilters(req.query, where, values);
    const whereSql = where.join(' and ');
    const countRow = await queryOne(`select count(*)::bigint as count from public.defects where ${whereSql}`, values);
    const listValues = [...values, pageSize, offset];
    const rows = await queryRows(
        `select ${DEFECT_LIST_COLUMNS}
         from public.defects
         where ${whereSql}
         order by created_at desc
         limit $${values.length + 1} offset $${values.length + 2}`,
        listValues
    );
    res.json({ data: rows, totalCount: countRow ? Number(countRow.count) : 0 });
}));

app.post('/api/defects', asyncRoute(async (req, res) => {
    const now = new Date().toISOString();
    const payload = pickBody(req.body, DEFECT_FIELDS);
    payload.defect_id = payload.defect_id || Date.now();
    payload.status = payload.status || 'Open';
    payload.is_deleted = payload.is_deleted || 'N';
    payload.created_at = payload.created_at || now;
    payload.updated_at = payload.updated_at || now;
    const insert = buildInsert('public.defects', payload);
    await pool.query(insert.sql, insert.values);
    res.status(201).json({ ok: true, defect_id: payload.defect_id });
}));

app.put('/api/defects/:id', asyncRoute(async (req, res) => {
    const payload = pickBody(req.body, DEFECT_FIELDS.filter(field => field !== 'defect_id' && field !== 'created_at'));
    payload.updated_at = new Date().toISOString();
    const update = buildUpdate('public.defects', payload, 'defect_id', req.params.id);
    await pool.query(update.sql, update.values);
    res.json({ ok: true });
}));

app.delete('/api/defects/:id', asyncRoute(async (req, res) => {
    await pool.query(
        `update public.defects set is_deleted = 'Y', updated_at = $2 where defect_id = $1`,
        [req.params.id, new Date().toISOString()]
    );
    res.json({ ok: true });
}));

app.get('/api/users/find', asyncRoute(async (req, res) => {
    const row = await queryOne('select * from public.users where email = $1', [req.query.email || '']);
    res.json(row);
}));

app.get('/api/users', asyncRoute(async (req, res) => {
    res.json(await queryRows('select * from public.users order by name asc'));
}));

app.post('/api/users', asyncRoute(async (req, res) => {
    const now = new Date().toISOString();
    const payload = pickBody(req.body, USER_FIELDS);
    payload.user_id = Number.parseInt(payload.user_id, 10) || Date.now();
    payload.status = payload.status || '사용';
    payload.created_at = payload.created_at || now;
    payload.updated_at = payload.updated_at || null;
    const insert = buildInsert('public.users', payload);
    await pool.query(insert.sql, insert.values);
    res.status(201).json({ ok: true, user_id: payload.user_id });
}));

app.put('/api/users/:id', asyncRoute(async (req, res) => {
    const payload = pickBody(req.body, USER_FIELDS.filter(field => field !== 'user_id' && field !== 'created_at'));
    payload.updated_at = new Date().toISOString();
    const update = buildUpdate('public.users', payload, 'user_id', req.params.id);
    await pool.query(update.sql, update.values);
    res.json({ ok: true });
}));

app.delete('/api/users/:id', asyncRoute(async (req, res) => {
    await pool.query('delete from public.users where user_id = $1', [req.params.id]);
    res.json({ ok: true });
}));

app.post('/api/users/reset-password', asyncRoute(async (req, res) => {
    await pool.query(
        `update public.users
         set password = $2, needs_password_reset = false, updated_at = $3
         where email = $1`,
        [req.body.email, req.body.password, new Date().toISOString()]
    );
    res.json({ ok: true });
}));

app.get('/api/common-codes', asyncRoute(async (req, res) => {
    res.json(await queryRows(
        `select group_code, code_value, code_name, color, sort_order
         from public.common_codes
         order by group_code asc, sort_order asc`
    ));
}));

app.post('/api/common-codes', asyncRoute(async (req, res) => {
    const payload = {
        group_code: req.body.group_code,
        code_value: req.body.code_value,
        code_name: req.body.code_name,
        color: req.body.color || null,
        sort_order: Number(req.body.sort_order || 0),
        is_active: true,
        updated_at: new Date().toISOString()
    };
    const original = req.body.originalKey || null;
    if (original?.group_code && original?.code_value) {
        const result = await pool.query(
            `update public.common_codes
             set group_code = $1, code_value = $2, code_name = $3, color = $4, sort_order = $5, updated_at = $6
             where group_code = $7 and code_value = $8`,
            [payload.group_code, payload.code_value, payload.code_name, payload.color, payload.sort_order, payload.updated_at, original.group_code, original.code_value]
        );
        if (result.rowCount > 0) return res.json({ ok: true });
    }
    const duplicate = await pool.query(
        `update public.common_codes
         set code_name = $3, color = $4, sort_order = $5, updated_at = $6
         where group_code = $1 and code_value = $2`,
        [payload.group_code, payload.code_value, payload.code_name, payload.color, payload.sort_order, payload.updated_at]
    );
    if (duplicate.rowCount > 0) return res.json({ ok: true });
    await pool.query(
        `insert into public.common_codes (group_code, code_value, code_name, color, sort_order, is_active, updated_at)
         values ($1, $2, $3, $4, $5, true, $6)`,
        [payload.group_code, payload.code_value, payload.code_name, payload.color, payload.sort_order, payload.updated_at]
    );
    res.json({ ok: true });
}));

app.delete('/api/common-codes', asyncRoute(async (req, res) => {
    await pool.query(
        'delete from public.common_codes where group_code = $1 and code_value = $2',
        [req.query.groupCode, req.query.codeValue]
    );
    res.json({ ok: true });
}));

app.get('/api/settings/global', asyncRoute(async (req, res) => {
    const row = await queryOne('select value from public.app_settings where key = $1', ['global_config']);
    res.json(row ? row.value : null);
}));

app.put('/api/settings/global', asyncRoute(async (req, res) => {
    await pool.query(
        `insert into public.app_settings (key, value, updated_at)
         values ('global_config', $1::jsonb, $2)
         on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
        [JSON.stringify(req.body || {}), new Date().toISOString()]
    );
    res.json({ ok: true });
}));

function normalizeErrorLogRow(row = {}) {
    const extra = row.extra || {};
    const payloadSummary = row.payload_summary || {};
    const creatorName = extra.creator_name || payloadSummary.creator || row.reported_by || '';
    const reporterName = extra.reporter_name || row.runtime_context?.current_user || '';
    return {
        log_id: row.client_log_id || (row.id ? `DB-${row.id}` : ''),
        central_log_id: row.id || null,
        created_at: row.created_at || '',
        operation: row.operation || '',
        defect_id: row.defect_id ?? null,
        pending_source: row.pending_source || '',
        stage: row.stage || '',
        error_type: row.error_type || '',
        message: row.message || '',
        runtime: row.runtime_context || {},
        payload_summary: payloadSummary,
        storage_error: {
            stage: row.stage || '',
            type: row.error_type || '',
            message: row.message || '',
            code: row.error_code || '',
            details: row.error_details || '',
            hint: row.error_hint || ''
        },
        extra,
        creator_name: creatorName,
        reporter_name: reporterName,
        reported_by: row.reported_by || creatorName || ''
    };
}

app.get('/api/error-logs', asyncRoute(async (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const rows = await queryRows(
        `select * from public.defect_save_error_logs order by created_at desc limit $1`,
        [limit]
    );
    res.json(rows.map(normalizeErrorLogRow));
}));

app.post('/api/error-logs', asyncRoute(async (req, res) => {
    const entry = req.body || {};
    const creatorName = entry.creator_name || entry.payload_summary?.creator || entry.runtime?.current_user || '';
    const reporterName = entry.reporter_name || entry.runtime?.current_user || '';
    const payload = {
        client_log_id: entry.log_id || null,
        operation: entry.operation || 'create',
        defect_id: entry.defect_id ?? null,
        pending_source: entry.pending_source || 'manual',
        stage: entry.stage || entry.storage_error?.stage || 'submit',
        error_type: entry.error_type || entry.storage_error?.type || 'unknown',
        message: entry.message || entry.storage_error?.message || '알 수 없는 저장 오류',
        error_code: entry.storage_error?.code || '',
        error_details: entry.storage_error?.details || '',
        error_hint: entry.storage_error?.hint || '',
        runtime_context: entry.runtime || {},
        payload_summary: entry.payload_summary || {},
        extra: { ...(entry.extra || {}), creator_name: creatorName, reporter_name: reporterName },
        reported_by: creatorName
    };
    const result = await pool.query(
        `insert into public.defect_save_error_logs
         (client_log_id, operation, defect_id, pending_source, stage, error_type, message,
          error_code, error_details, error_hint, runtime_context, payload_summary, extra, reported_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14)
         returning *`,
        [
            payload.client_log_id, payload.operation, payload.defect_id, payload.pending_source,
            payload.stage, payload.error_type, payload.message, payload.error_code, payload.error_details,
            payload.error_hint, JSON.stringify(payload.runtime_context), JSON.stringify(payload.payload_summary),
            JSON.stringify(payload.extra), payload.reported_by
        ]
    );
    res.status(201).json({ ok: true, data: normalizeErrorLogRow(result.rows[0]) });
}));

app.post('/api/history', asyncRoute(async (req, res) => {
    const entry = req.body || {};
    await pool.query(
        `insert into public.defect_history
         (defect_id, action, status_before, status_after, changed_data, changed_by, created_at)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [
            entry.defect_id || null,
            entry.action || '',
            entry.status_before || null,
            entry.status_after || null,
            JSON.stringify(entry.changed_data || {}),
            entry.changed_by || '',
            entry.created_at || new Date().toISOString()
        ]
    );
    res.status(201).json({ ok: true });
}));

app.use(express.static(staticRoot));

app.use((error, req, res, next) => {
    console.error('[API]', error);
    res.status(500).json({
        ok: false,
        error: {
            message: error.message || 'Internal server error',
            code: error.code || '',
            details: error.detail || error.details || '',
            hint: error.hint || ''
        }
    });
});

app.listen(PORT, () => {
    console.log(`DefectFlow local API running at http://localhost:${PORT}`);
    console.log(`PostgreSQL ${pool.options.host}:${pool.options.port}/${pool.options.database}`);
    console.log(`Working Directory: ${__dirname}`);
});
