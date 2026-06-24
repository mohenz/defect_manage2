(function attachDefectFlowSettingsStorageService(global) {
    function createDefectFlowSettingsStorageService({ supabaseClient, getISO }) {
        return {
            async getAppSettings() {
                console.log('[Storage] Fetching global app settings...');
                try {
                    const { data, error } = await supabaseClient
                        .from('app_settings')
                        .select('*')
                        .eq('key', 'global_config')
                        .single();

                    if (error) {
                        if (error.code === 'PGRST116') {
                            console.log('[Storage] No settings found, using defaults.');
                            return null;
                        }
                        throw error;
                    }
                    return data.value;
                } catch (err) {
                    console.error('[Storage] Error fetching app settings:', err);
                    return null;
                }
            },

            async saveAppSettings(settings) {
                console.log('[Storage] Saving global app settings...', settings);
                try {
                    const { error } = await supabaseClient
                        .from('app_settings')
                        .upsert({
                            key: 'global_config',
                            value: settings,
                            updated_at: getISO()
                        }, { onConflict: 'key' });

                    if (error) throw error;
                    console.log('[Storage] App settings saved successfully.');
                    return true;
                } catch (err) {
                    console.error('[Storage] Error saving app settings:', err);
                    return false;
                }
            }
        };
    }

    global.createDefectFlowSettingsStorageService = createDefectFlowSettingsStorageService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDefectFlowSettingsStorageService;
    }
})(typeof window !== 'undefined' ? window : globalThis);
