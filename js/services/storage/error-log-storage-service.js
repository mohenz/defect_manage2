(function attachDefectFlowErrorLogStorageService(global) {
    function createDefectFlowErrorLogStorageService({ supabaseClient, getISO }) {
        function normalizeDefectSaveErrorLogRow(row = {}) {
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

        async function saveDefectSaveErrorLog(logEntry = {}) {
            try {
                const creatorName = logEntry.creator_name || logEntry.payload_summary?.creator || logEntry.runtime?.current_user || '';
                const reporterName = logEntry.reporter_name || logEntry.runtime?.current_user || '';
                const payload = {
                    client_log_id: logEntry.log_id || null,
                    operation: logEntry.operation || 'create',
                    defect_id: logEntry.defect_id ?? null,
                    pending_source: logEntry.pending_source || 'manual',
                    stage: logEntry.stage || logEntry.storage_error?.stage || 'submit',
                    error_type: logEntry.error_type || logEntry.storage_error?.type || 'unknown',
                    message: logEntry.message || logEntry.storage_error?.message || '알 수 없는 저장 오류',
                    error_code: logEntry.storage_error?.code || '',
                    error_details: logEntry.storage_error?.details || '',
                    error_hint: logEntry.storage_error?.hint || '',
                    runtime_context: logEntry.runtime || {},
                    payload_summary: logEntry.payload_summary || {},
                    extra: {
                        ...(logEntry.extra || {}),
                        creator_name: creatorName,
                        reporter_name: reporterName
                    },
                    reported_by: creatorName
                };

                const { error } = await supabaseClient
                    .from('defect_save_error_logs')
                    .insert([payload]);

                if (error) {
                    console.error('[Storage] Error inserting defect save error log:', error.message);
                    return {
                        ok: false,
                        error: {
                            message: error.message || '중앙 오류 로그 저장에 실패했습니다.',
                            code: error.code || '',
                            details: error.details || '',
                            hint: error.hint || ''
                        }
                    };
                }

                return {
                    ok: true,
                    data: normalizeDefectSaveErrorLogRow({
                        ...payload,
                        created_at: getISO()
                    })
                };
            } catch (err) {
                console.error('[Storage] Exception in saveDefectSaveErrorLog:', err);
                return {
                    ok: false,
                    error: {
                        message: err?.message || '중앙 오류 로그 저장 중 예외가 발생했습니다.',
                        name: err?.name || 'Error'
                    }
                };
            }
        }

        async function getDefectSaveErrorLogs(limit = 100) {
            const { data, error } = await supabaseClient
                .from('defect_save_error_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('[Storage] Error fetching defect save error logs:', error.message);
                throw error;
            }

            return (data || []).map(row => normalizeDefectSaveErrorLogRow(row));
        }

        return {
            normalizeDefectSaveErrorLogRow,
            saveDefectSaveErrorLog,
            getDefectSaveErrorLogs
        };
    }

    global.createDefectFlowErrorLogStorageService = createDefectFlowErrorLogStorageService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDefectFlowErrorLogStorageService;
    }
})(typeof window !== 'undefined' ? window : globalThis);
