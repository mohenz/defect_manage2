(function attachDefectFlowDefectStorageService(global) {
    function createDefectFlowDefectStorageService({
        supabaseClient,
        getISO,
        applyDefectFilters,
        enrichLengthOverflowError,
        defectSummaryColumns,
        defectListColumns,
        defectExportColumns,
        actionRecheckStatusValues,
        actionRecheckQueryStatusValues,
        isBlankTextValue
    }) {
        let lastDefectSaveError = null;

        return {
            async getDefectsSummaryForStats() {
                console.log('[Storage] Fetching stats summary with timeout...');
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Supabase Stats Timeout')), 10000);
                });

                const queryPromise = (async () => {
                    try {
                        const pageSize = 1000;
                        const rows = [];
                        let from = 0;

                        while (true) {
                            const { data, error } = await supabaseClient
                                .from('defects')
                                .select(defectSummaryColumns)
                                .eq('is_deleted', 'N')
                                .order('defect_id', { ascending: true })
                                .range(from, from + pageSize - 1);

                            if (error) throw error;

                            const pageRows = data || [];
                            rows.push(...pageRows);

                            if (pageRows.length < pageSize) break;
                            from += pageSize;
                        }

                        return rows;
                    } catch (err) {
                        console.error('[Storage] Supabase stats error:', err.message);
                        throw err;
                    }
                })();

                try {
                    return await Promise.race([queryPromise, timeoutPromise]);
                } catch (err) {
                    console.warn('[Storage] getDefectsSummaryForStats failed or timed out. Falling back to empty array.');
                    return [];
                }
            },

            async getDefects(page = 1, pageSize = 20, filters = {}) {
                console.log(`[Storage] Fetching defects (Page ${page})...`, filters);
                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;
                const query = applyDefectFilters(
                    supabaseClient
                        .from('defects')
                        .select(defectListColumns, { count: 'exact' })
                        .eq('is_deleted', 'N'),
                    filters
                );

                const { data, error, count } = await query
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (error) {
                    console.error('[Storage] Error fetching defects:', error.message);
                    throw error;
                }

                return { data: data || [], totalCount: count || 0 };
            },

            async getAllDefectsForExport(filters = {}) {
                console.log('[Storage] Fetching all defects for export...', filters);
                const query = applyDefectFilters(
                    supabaseClient
                        .from('defects')
                        .select(defectExportColumns)
                        .eq('is_deleted', 'N'),
                    filters
                );

                const { data, error } = await query.order('created_at', { ascending: false });

                if (error) {
                    console.error('[Storage] Error fetching defects for export:', error.message);
                    throw error;
                }

                return data || [];
            },

            async getDefectById(id) {
                console.log(`[Storage] Requesting defect detail #${id}...`);
                const { data, error } = await supabaseClient
                    .from('defects')
                    .select('*')
                    .eq('defect_id', id)
                    .single();

                if (error) {
                    console.error('[Storage] Error fetching defect detail:', error.message);
                    throw error;
                }

                return data;
            },

            async saveDefect(payload, id = null) {
                console.log(`[Storage] Saving defect (${id ? 'Update' : 'New'})...`, payload);
                const now = getISO();
                lastDefectSaveError = null;

                try {
                    if (payload.screenshot && payload.screenshot.startsWith('data:image')) {
                        console.log('[Storage] New image detected, saving inline screenshot payload.');
                    }

                    if (id) {
                        const { error } = await supabaseClient
                            .from('defects')
                            .update({ ...payload, updated_at: now })
                            .eq('defect_id', id);

                        if (error) {
                            console.error('[Storage] Error updating defect:', error.message);
                            lastDefectSaveError = enrichLengthOverflowError({
                                operation: 'update',
                                stage: 'supabase.update',
                                type: 'supabase',
                                message: error.message || '결함 수정 중 오류가 발생했습니다.',
                                code: error.code || '',
                                details: error.details || '',
                                hint: error.hint || ''
                            }, payload);
                            return { ok: false, error: lastDefectSaveError };
                        }

                        console.log('[Storage] Defect updated successfully.');
                        return { ok: true };
                    }

                    const { error } = await supabaseClient
                        .from('defects')
                        .insert([{
                            ...payload,
                            status: payload.status || 'Open',
                            created_at: now
                        }]);

                    if (error) {
                        console.error('[Storage] Error inserting defect:', error.message);
                        lastDefectSaveError = enrichLengthOverflowError({
                            operation: 'insert',
                            stage: 'supabase.insert',
                            type: 'supabase',
                            message: error.message || '결함 등록 중 오류가 발생했습니다.',
                            code: error.code || '',
                            details: error.details || '',
                            hint: error.hint || ''
                        }, payload);
                        return { ok: false, error: lastDefectSaveError };
                    }

                    console.log('[Storage] Defect inserted successfully.');
                    return { ok: true };
                } catch (err) {
                    console.error('[Storage] Exception in saveDefect:', err);
                    lastDefectSaveError = {
                        operation: id ? 'update' : 'insert',
                        stage: 'exception',
                        type: 'exception',
                        message: err?.message || '저장 중 예외가 발생했습니다.',
                        name: err?.name || 'Error',
                        stack: err?.stack || ''
                    };
                    return { ok: false, error: lastDefectSaveError };
                }
            },

            getLastDefectSaveError() {
                return lastDefectSaveError ? { ...lastDefectSaveError } : null;
            },

            async getDefectsNeedingActionRecheck() {
                const { data, error } = await supabaseClient
                    .from('defects')
                    .select('defect_id, assignee, status, defect_identification, action_comment')
                    .eq('is_deleted', 'N')
                    .in('status', actionRecheckQueryStatusValues)
                    .order('defect_id', { ascending: false });

                if (error) {
                    console.error('[Storage] Error fetching defects needing action recheck:', error.message);
                    throw error;
                }

                return (data || []).filter(item => {
                    const normalizedStatus = String(item.status || '').trim().toLowerCase();
                    return actionRecheckStatusValues.includes(normalizedStatus)
                        && isBlankTextValue(item.defect_identification)
                        && isBlankTextValue(item.action_comment);
                }).map(item => ({
                    defect_id: item.defect_id,
                    assignee: item.assignee || '',
                    status: item.status || ''
                }));
            },

            async deleteDefect(id) {
                console.log(`[Storage] Deleting defect #${id}...`);
                const { error } = await supabaseClient
                    .from('defects')
                    .update({ is_deleted: 'Y', updated_at: getISO() })
                    .eq('defect_id', id);

                if (error) {
                    console.error('[Storage] Error deleting defect:', error.message);
                    return false;
                }

                console.log('[Storage] Defect deleted successfully.');
                return true;
            }
        };
    }

    global.createDefectFlowDefectStorageService = createDefectFlowDefectStorageService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDefectFlowDefectStorageService;
    }
})(typeof window !== 'undefined' ? window : globalThis);
