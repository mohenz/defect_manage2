(function attachDefectFlowCommonCodeStorageService(global) {
    function createDefectFlowCommonCodeStorageService({ supabaseClient }) {
        return {
            async fetchCommonCodes() {
                console.log('[Storage] Fetching common codes with timeout...');
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Supabase Query Timeout')), 3000);
                });

                const queryPromise = (async () => {
                    try {
                        const { data, error } = await supabaseClient
                            .from('common_codes')
                            .select('group_code, code_value, code_name, color, sort_order')
                            .order('group_code', { ascending: true })
                            .order('sort_order', { ascending: true });

                        if (error) throw error;
                        return data;
                    } catch (err) {
                        console.error('[Storage] Supabase error in fetchCommonCodes:', err.message);
                        throw err;
                    }
                })();

                try {
                    return await Promise.race([queryPromise, timeoutPromise]);
                } catch (err) {
                    console.warn('[Storage] fetchCommonCodes failed or timed out. Falling back to empty array.');
                    return [];
                }
            },

            async saveCommonCode(payload, originalKey = null) {
                console.log('[Storage] Saving common code...', payload, originalKey);

                const normalized = {
                    group_code: payload.group_code,
                    code_value: payload.code_value,
                    code_name: payload.code_name,
                    color: payload.color || null,
                    sort_order: Number(payload.sort_order || 0)
                };

                try {
                    if (originalKey) {
                        const { data: existingRows, error: existingError } = await supabaseClient
                            .from('common_codes')
                            .select('id')
                            .eq('group_code', originalKey.group_code)
                            .eq('code_value', originalKey.code_value);

                        if (existingError) throw existingError;

                        if (!existingRows || existingRows.length === 0) {
                            const { error: insertError } = await supabaseClient
                                .from('common_codes')
                                .insert([{ ...normalized, is_active: true }]);

                            if (insertError) throw insertError;
                            return true;
                        }

                        const { error: updateError } = await supabaseClient
                            .from('common_codes')
                            .update(normalized)
                            .eq('group_code', originalKey.group_code)
                            .eq('code_value', originalKey.code_value);

                        if (updateError) throw updateError;
                        return true;
                    }

                    const { data: duplicateRows, error: duplicateError } = await supabaseClient
                        .from('common_codes')
                        .select('id')
                        .eq('group_code', normalized.group_code)
                        .eq('code_value', normalized.code_value);

                    if (duplicateError) throw duplicateError;

                    if (duplicateRows && duplicateRows.length > 0) {
                        const { error: updateDuplicateError } = await supabaseClient
                            .from('common_codes')
                            .update(normalized)
                            .eq('group_code', normalized.group_code)
                            .eq('code_value', normalized.code_value);

                        if (updateDuplicateError) throw updateDuplicateError;
                        return true;
                    }

                    const { error } = await supabaseClient
                        .from('common_codes')
                        .insert([{ ...normalized, is_active: true }]);

                    if (error) throw error;
                    return true;
                } catch (err) {
                    console.error('[Storage] Error saving common code:', err.message);
                    return false;
                }
            },

            async deleteCommonCode(groupCode, codeValue) {
                console.log(`[Storage] Deleting common code ${groupCode}/${codeValue}...`);
                try {
                    const { error } = await supabaseClient
                        .from('common_codes')
                        .delete()
                        .eq('group_code', groupCode)
                        .eq('code_value', codeValue);

                    if (error) throw error;
                    return true;
                } catch (err) {
                    console.error('[Storage] Error deleting common code:', err.message);
                    return false;
                }
            }
        };
    }

    global.createDefectFlowCommonCodeStorageService = createDefectFlowCommonCodeStorageService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDefectFlowCommonCodeStorageService;
    }
})(typeof window !== 'undefined' ? window : globalThis);
