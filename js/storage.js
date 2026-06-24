/**
 * Local API Data Persistence Service
 */

console.log('[Storage] Initializing local API client:', CONFIG.API_BASE_URL);

const API_BASE_URL = (CONFIG.API_BASE_URL || '/api').replace(/\/$/, '');
const DEFECT_FIELD_LENGTH_HINTS = {
    title: 200,
    test_type: 50,
    severity: 20,
    priority: 10,
    status: 20,
    menu_name: 100,
    screen_name: 100,
    screen_url: 255,
    defect_identification: 50,
    creator: 50,
    assignee: 50,
    env_info: 255
};

function collectOverflowCandidates(payload = {}, options = {}) {
    const exactLimit = Number.isFinite(options.exactLimit) ? Number(options.exactLimit) : null;

    return Object.entries(DEFECT_FIELD_LENGTH_HINTS)
        .map(([field, assumedLimit]) => {
            const rawValue = payload[field];
            const value = typeof rawValue === 'string' ? rawValue : String(rawValue || '');

            return {
                field,
                length: value.length,
                assumed_limit: assumedLimit
            };
        })
        .filter(candidate => candidate.length > 0)
        .filter(candidate => exactLimit
            ? candidate.assumed_limit === exactLimit && candidate.length > exactLimit
            : candidate.length > candidate.assumed_limit)
        .sort((a, b) => b.length - a.length);
}

function enrichLengthOverflowError(error = {}, payload = {}) {
    const message = error?.message || '';
    const limitMatch = message.match(/character varying\((\d+)\)/i);
    const exactLimit = limitMatch ? Number(limitMatch[1]) : null;
    const candidates = collectOverflowCandidates(payload, { exactLimit });
    const fallbackCandidates = candidates.length > 0 ? candidates : collectOverflowCandidates(payload);

    if (!exactLimit && fallbackCandidates.length === 0) {
        return error;
    }

    return {
        ...error,
        varchar_limit: exactLimit,
        overflow_candidates: fallbackCandidates
    };
}

function appendQuery(url, params = {}) {
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            if (value.length > 0) url.searchParams.set(key, value.join(','));
            return;
        }
        url.searchParams.set(key, String(value));
    });
}

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
        const error = payload?.error || payload || {};
        throw {
            message: error.message || response.statusText,
            code: error.code || '',
            details: error.details || '',
            hint: error.hint || ''
        };
    }

    return payload;
}

async function getJson(path, params = {}) {
    const url = new URL(path, window.location.origin);
    appendQuery(url, params);
    const apiPath = `${path}${url.search}`;
    return request(apiPath);
}

let lastDefectSaveError = null;

const StorageService = {
    getISO() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, -1);
    },

    init() {
        console.log('[Storage] Local API StorageService ready.');
    },

    async fetchCommonCodes() {
        try {
            return await getJson('/common-codes');
        } catch (err) {
            console.warn('[Storage] fetchCommonCodes failed. Falling back to empty array.', err);
            return [];
        }
    },

    async saveCommonCode(payload, originalKey = null) {
        try {
            await request('/common-codes', {
                method: 'POST',
                body: JSON.stringify({ ...payload, originalKey })
            });
            return true;
        } catch (err) {
            console.error('[Storage] Error saving common code:', err.message);
            return false;
        }
    },

    async deleteCommonCode(groupCode, codeValue) {
        try {
            await request(`/common-codes?groupCode=${encodeURIComponent(groupCode)}&codeValue=${encodeURIComponent(codeValue)}`, {
                method: 'DELETE'
            });
            return true;
        } catch (err) {
            console.error('[Storage] Error deleting common code:', err.message);
            return false;
        }
    },

    async logHistory(defectId, action, changedBy, details = {}, before = null, after = null) {
        try {
            await request('/history', {
                method: 'POST',
                body: JSON.stringify({
                    defect_id: defectId,
                    action,
                    status_before: before,
                    status_after: after,
                    changed_data: details,
                    changed_by: changedBy,
                    created_at: StorageService.getISO()
                })
            });
        } catch (err) {
            console.error('[StorageService] History logging failed:', err);
        }
    },

    async getDefectsSummaryForStats() {
        try {
            return await getJson('/defects/summary');
        } catch (err) {
            console.warn('[Storage] getDefectsSummaryForStats failed. Falling back to empty array.', err);
            return [];
        }
    },

    async getDefects(page = 1, pageSize = 20, filters = {}) {
        return getJson('/defects', { page, pageSize, ...filters });
    },

    async getAllDefectsForExport(filters = {}) {
        return getJson('/defects/export', filters);
    },

    async getDefectById(id) {
        return getJson(`/defects/${encodeURIComponent(id)}`);
    },

    async saveDefect(payload, id = null) {
        lastDefectSaveError = null;
        try {
            await request(id ? `/defects/${encodeURIComponent(id)}` : '/defects', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            return { ok: true };
        } catch (err) {
            lastDefectSaveError = enrichLengthOverflowError({
                operation: id ? 'update' : 'insert',
                stage: id ? 'local.update' : 'local.insert',
                type: 'local_api',
                message: err.message || '결함 저장 중 오류가 발생했습니다.',
                code: err.code || '',
                details: err.details || '',
                hint: err.hint || ''
            }, payload);
            return { ok: false, error: lastDefectSaveError };
        }
    },

    getLastDefectSaveError() {
        return lastDefectSaveError ? { ...lastDefectSaveError } : null;
    },

    async getDefectsNeedingActionRecheck() {
        return getJson('/defects/action-recheck');
    },

    async deleteDefect(id) {
        try {
            await request(`/defects/${encodeURIComponent(id)}`, { method: 'DELETE' });
            return true;
        } catch (err) {
            console.error('[Storage] Error deleting defect:', err.message);
            return false;
        }
    },

    async getUsers() {
        return getJson('/users');
    },

    async saveUser(payload, id = null) {
        try {
            await request(id ? `/users/${encodeURIComponent(id)}` : '/users', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            return true;
        } catch (err) {
            console.error('[Storage] Error saving user:', err.message);
            return false;
        }
    },

    async findUserByEmail(email) {
        return getJson('/users/find', { email });
    },

    async resetPassword(email, hashedPassword) {
        try {
            await request('/users/reset-password', {
                method: 'POST',
                body: JSON.stringify({ email, password: hashedPassword })
            });
            return true;
        } catch (err) {
            console.error('[Storage] Error resetting password:', err.message);
            return false;
        }
    },

    async deleteUser(id) {
        try {
            await request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
            return true;
        } catch (err) {
            console.error('[Storage] Error deleting user:', err.message);
            return false;
        }
    },

    async getAppSettings() {
        try {
            return await getJson('/settings/global');
        } catch (err) {
            console.error('[Storage] Error fetching app settings:', err);
            return null;
        }
    },

    async saveAppSettings(settings) {
        try {
            await request('/settings/global', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            return true;
        } catch (err) {
            console.error('[Storage] Error saving app settings:', err);
            return false;
        }
    },

    async saveDefectSaveErrorLog(logEntry = {}) {
        try {
            return await request('/error-logs', {
                method: 'POST',
                body: JSON.stringify(logEntry)
            });
        } catch (err) {
            return {
                ok: false,
                error: {
                    message: err?.message || '중앙 오류 로그 저장에 실패했습니다.',
                    code: err?.code || '',
                    details: err?.details || '',
                    hint: err?.hint || ''
                }
            };
        }
    },

    async getDefectSaveErrorLogs(limit = 100) {
        return getJson('/error-logs', { limit });
    }
};

StorageService.history = {
    log: (...args) => StorageService.logHistory(...args)
};

StorageService.commonCodes = {
    fetch: (...args) => StorageService.fetchCommonCodes(...args),
    save: (...args) => StorageService.saveCommonCode(...args),
    remove: (...args) => StorageService.deleteCommonCode(...args)
};

StorageService.defects = {
    getSummaryForStats: (...args) => StorageService.getDefectsSummaryForStats(...args),
    getList: (...args) => StorageService.getDefects(...args),
    getAllForExport: (...args) => StorageService.getAllDefectsForExport(...args),
    getById: (...args) => StorageService.getDefectById(...args),
    save: (...args) => StorageService.saveDefect(...args),
    remove: (...args) => StorageService.deleteDefect(...args),
    getNeedingActionRecheck: (...args) => StorageService.getDefectsNeedingActionRecheck(...args)
};

StorageService.logs = {
    saveDefectSaveError: (...args) => StorageService.saveDefectSaveErrorLog(...args),
    getDefectSaveErrors: (...args) => StorageService.getDefectSaveErrorLogs(...args)
};

StorageService.users = {
    getList: (...args) => StorageService.getUsers(...args),
    save: (...args) => StorageService.saveUser(...args),
    findByEmail: (...args) => StorageService.findUserByEmail(...args),
    resetPassword: (...args) => StorageService.resetPassword(...args),
    remove: (...args) => StorageService.deleteUser(...args)
};

StorageService.settings = {
    get: (...args) => StorageService.getAppSettings(...args),
    save: (...args) => StorageService.saveAppSettings(...args)
};

StorageService.usersApi = StorageService.users;
StorageService.settingsApi = StorageService.settings;
