(function attachDefectFlowUserStorageService(global) {
    function createDefectFlowUserStorageService({ supabaseClient, getISO }) {
        return {
            async getUsers() {
                console.log('[Storage] Requesting users list...');
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('*')
                    .order('name', { ascending: true });

                if (error) {
                    console.error('[Storage] Error fetching users:', error.message);
                    throw error;
                }
                console.log('[Storage] Users fetched successfully.');
                return data;
            },

            async saveUser(payload, id = null) {
                console.log(`[Storage] Saving user (${id ? 'Update' : 'New'})...`, payload);
                const now = getISO();

                if (id) {
                    const { error } = await supabaseClient
                        .from('users')
                        .update({ ...payload, updated_at: now })
                        .eq('user_id', id);

                    if (error) console.error('[Storage] Error updating user:', error.message);
                    else console.log('[Storage] User updated successfully.');
                    return !error;
                }

                const numericId = parseInt(payload.user_id, 10) || Date.now();
                const { error } = await supabaseClient
                    .from('users')
                    .insert([{
                        ...payload,
                        user_id: numericId,
                        status: payload.status || '사용',
                        created_at: now,
                        updated_at: null
                    }]);

                if (error) console.error('[Storage] Error inserting user:', error.message);
                else console.log('[Storage] User inserted successfully.');
                return !error;
            },

            async findUserByEmail(email) {
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('[Storage] Error finding user:', error.message);
                }
                return data;
            },

            async resetPassword(email, hashedPassword) {
                console.log(`[Storage] Resetting password for ${email}...`);
                const { error } = await supabaseClient
                    .from('users')
                    .update({
                        password: hashedPassword,
                        updated_at: getISO(),
                        needs_password_reset: false
                    })
                    .eq('email', email);

                if (error) {
                    console.error('[Storage] Error resetting password:', error.message);
                    return false;
                }
                console.log('[Storage] Password reset successfully.');
                return true;
            },

            async deleteUser(id) {
                console.log(`[Storage] Deleting user #${id}...`);
                const { error } = await supabaseClient
                    .from('users')
                    .delete()
                    .eq('user_id', id);

                if (error) console.error('[Storage] Error deleting user:', error.message);
                else console.log('[Storage] User deleted successfully.');
                return !error;
            }
        };
    }

    global.createDefectFlowUserStorageService = createDefectFlowUserStorageService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDefectFlowUserStorageService;
    }
})(typeof window !== 'undefined' ? window : globalThis);
