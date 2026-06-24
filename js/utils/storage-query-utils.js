(function attachDefectFlowStorageQueryUtils(global) {
    const LIST_STATUS_PRESET_NOT_COMPLETED = '__NOT_COMPLETED__';
    const NOT_COMPLETED_STATUS_VALUES = ['Open', 'In Progress', 'Reopened'];

    function normalizeDefectIdFilter(defectId) {
        const normalized = String(defectId || '').trim();
        if (!normalized) return null;
        if (!/^\d+$/.test(normalized)) return null;

        const parsed = Number.parseInt(normalized, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    function isBlankTextValue(value) {
        return String(value || '').trim() === '';
    }

    function normalizeScreenPathValue(screenPath = '') {
        return String(screenPath || '')
            .split('>')
            .map(part => part.replace(/\u3000/g, ' ').trim())
            .filter(Boolean)
            .join(' > ');
    }

    function parseScreenPathFilter(screenPath = '') {
        const normalized = normalizeScreenPathValue(screenPath);
        if (!normalized) {
            return {
                menuName: '',
                screenName: ''
            };
        }

        const parts = normalized.split(' > ').filter(Boolean);
        const screenName = parts.pop() || '';

        return {
            menuName: parts.join(' > '),
            screenName
        };
    }

    function applyDefectFilters(query, filters = {}) {
        const defectIdFilter = normalizeDefectIdFilter(filters.defectId);

        if (defectIdFilter !== null) query = query.eq('defect_id', defectIdFilter);
        if (filters.severity) query = query.eq('severity', filters.severity);
        if (filters.statusPreset === LIST_STATUS_PRESET_NOT_COMPLETED) {
            query = query.in('status', NOT_COMPLETED_STATUS_VALUES);
        } else if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.title) query = query.ilike('title', `%${filters.title}%`);
        if (filters.stepsToRepro) query = query.ilike('steps_to_repro', `%${filters.stepsToRepro}%`);
        if (filters.testType) query = query.eq('test_type', filters.testType);
        if (Array.isArray(filters.enabledTestTypes) && filters.enabledTestTypes.length > 0) {
            query = query.in('test_type', filters.enabledTestTypes);
        }
        if (filters.identificationUnassigned) {
            query = query.or('defect_identification.is.null,defect_identification.eq.');
        } else if (filters.identification) {
            query = query.eq('defect_identification', filters.identification);
        }
        if (filters.screenPath) {
            const parsedScreenPath = parseScreenPathFilter(filters.screenPath);
            if (parsedScreenPath.menuName) query = query.eq('menu_name', parsedScreenPath.menuName);
            if (parsedScreenPath.screenName) query = query.eq('screen_name', parsedScreenPath.screenName);
        }
        if (filters.creator) query = query.ilike('creator', `%${filters.creator}%`);
        if (filters.assigneeUnassigned) {
            query = query.or('assignee.is.null,assignee.eq.');
        } else if (filters.assignee) {
            query = query.ilike('assignee', `%${filters.assignee}%`);
        }
        if (filters.dateStart) query = query.gte('created_at', `${filters.dateStart}T00:00:00`);
        if (filters.dateEnd) query = query.lte('created_at', `${filters.dateEnd}T23:59:59`);

        return query;
    }

    const storageQueryUtils = {
        normalizeDefectIdFilter,
        isBlankTextValue,
        normalizeScreenPathValue,
        parseScreenPathFilter,
        applyDefectFilters
    };

    global.DefectFlowStorageQueryUtils = storageQueryUtils;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = storageQueryUtils;
    }
})(typeof window !== 'undefined' ? window : globalThis);
