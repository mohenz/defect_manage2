import { describe, expect, it } from 'vitest';
import createErrorLogStorageService from '../../js/services/storage/error-log-storage-service.js';

describe('error-log-storage-service', () => {
    it('중앙 오류 로그 행을 화면 표시용 구조로 정규화한다', () => {
        const service = createErrorLogStorageService({
            supabaseClient: {},
            getISO: () => '2026-04-02T00:00:00'
        });

        const normalized = service.normalizeDefectSaveErrorLogRow({
            id: 17,
            client_log_id: 'DEFECT-1',
            created_at: '2026-04-02T01:02:03',
            operation: 'create',
            defect_id: 42,
            pending_source: 'standalone',
            stage: 'supabase.insert',
            error_type: 'supabase',
            message: 'varchar overflow',
            error_code: '22001',
            error_details: 'too long',
            error_hint: 'shorten text',
            runtime_context: { current_user: '리포터' },
            payload_summary: { creator: '작성자' },
            extra: { reporter_name: '신고자' },
            reported_by: '최초등록자'
        });

        expect(normalized).toEqual({
            log_id: 'DEFECT-1',
            central_log_id: 17,
            created_at: '2026-04-02T01:02:03',
            operation: 'create',
            defect_id: 42,
            pending_source: 'standalone',
            stage: 'supabase.insert',
            error_type: 'supabase',
            message: 'varchar overflow',
            runtime: { current_user: '리포터' },
            payload_summary: { creator: '작성자' },
            storage_error: {
                stage: 'supabase.insert',
                type: 'supabase',
                message: 'varchar overflow',
                code: '22001',
                details: 'too long',
                hint: 'shorten text'
            },
            extra: { reporter_name: '신고자' },
            creator_name: '작성자',
            reporter_name: '신고자',
            reported_by: '최초등록자'
        });
    });
});
