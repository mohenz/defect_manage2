(function attachDefectFlowHistoryStorageService(global) {
    function createDefectFlowHistoryStorageService({ supabaseClient, getISO }) {
        return {
            async logHistory(defectId, action, changedBy, details = {}, before = null, after = null) {
                try {
                    const entry = {
                        defect_id: defectId,
                        action,
                        status_before: before,
                        status_after: after,
                        changed_data: details,
                        changed_by: changedBy,
                        created_at: getISO()
                    };
                    await supabaseClient.from('defect_history').insert(entry);
                } catch (err) {
                    console.error('[StorageService] History logging failed:', err);
                }
            }
        };
    }

    global.createDefectFlowHistoryStorageService = createDefectFlowHistoryStorageService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDefectFlowHistoryStorageService;
    }
})(typeof window !== 'undefined' ? window : globalThis);
