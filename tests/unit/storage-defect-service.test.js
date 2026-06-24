import { describe, expect, it } from 'vitest';
import createDefectFlowDefectStorageService from '../../js/services/storage/defect-storage-service.js';

function createSupabaseStub(responseFactory) {
    return {
        from() {
            return responseFactory();
        }
    };
}

describe('defect-storage-service', () => {
    it('대시보드 요약 데이터는 1000건 단위로 끝까지 조회한다', async () => {
        const ranges = [];
        const pages = [
            Array.from({ length: 1000 }, (_, index) => ({ defect_id: index + 1 })),
            [
                { defect_id: 1001 },
                { defect_id: 1002 },
                { defect_id: 1003 }
            ]
        ];
        const supabaseClient = createSupabaseStub(() => ({
            select() { return this; },
            eq() { return this; },
            order() { return this; },
            async range(from, to) {
                ranges.push([from, to]);
                const pageIndex = ranges.length - 1;
                return {
                    data: pages[pageIndex] || [],
                    error: null
                };
            }
        }));

        const service = createDefectFlowDefectStorageService({
            supabaseClient,
            getISO: () => '2026-04-02T00:00:00',
            applyDefectFilters: query => query,
            enrichLengthOverflowError: error => error,
            defectSummaryColumns: 'defect_id',
            defectListColumns: '',
            defectExportColumns: '',
            actionRecheckStatusValues: ['resolved'],
            actionRecheckQueryStatusValues: ['resolved'],
            isBlankTextValue: value => String(value || '').trim() === ''
        });

        const summary = await service.getDefectsSummaryForStats();

        expect(summary).toHaveLength(1003);
        expect(ranges).toEqual([
            [0, 999],
            [1000, 1999]
        ]);
    });

    it('저장 실패 시 마지막 결함 저장 오류를 유지한다', async () => {
        const supabaseClient = createSupabaseStub(() => ({
            insert: async () => ({
                error: {
                    message: 'value too long for type character varying(50)',
                    code: '22001',
                    details: 'title overflow',
                    hint: 'shorten title'
                }
            })
        }));

        const service = createDefectFlowDefectStorageService({
            supabaseClient,
            getISO: () => '2026-04-02T00:00:00',
            applyDefectFilters: query => query,
            enrichLengthOverflowError: error => ({ ...error, normalized: true }),
            defectSummaryColumns: '',
            defectListColumns: '',
            defectExportColumns: '',
            actionRecheckStatusValues: ['resolved'],
            actionRecheckQueryStatusValues: ['resolved'],
            isBlankTextValue: value => String(value || '').trim() === ''
        });

        const result = await service.saveDefect({
            title: 'A very long defect title'
        });

        expect(result.ok).toBe(false);
        expect(result.error.normalized).toBe(true);
        expect(service.getLastDefectSaveError()).toEqual(result.error);
    });

    it('조치 재확인 대상만 선별한다', async () => {
        const supabaseClient = createSupabaseStub(() => ({
            select() { return this; },
            eq() { return this; },
            in() { return this; },
            order: async () => ({
                data: [
                    { defect_id: 1, assignee: '담당자1', status: 'Resolved', defect_identification: '', action_comment: '' },
                    { defect_id: 2, assignee: '담당자2', status: 'Closed', defect_identification: '기능', action_comment: '' },
                    { defect_id: 3, assignee: '', status: 'Staging', defect_identification: null, action_comment: null }
                ],
                error: null
            })
        }));

        const service = createDefectFlowDefectStorageService({
            supabaseClient,
            getISO: () => '2026-04-02T00:00:00',
            applyDefectFilters: query => query,
            enrichLengthOverflowError: error => error,
            defectSummaryColumns: '',
            defectListColumns: '',
            defectExportColumns: '',
            actionRecheckStatusValues: ['resolved', 'closed', 'staging'],
            actionRecheckQueryStatusValues: ['Resolved', 'Closed', 'Staging'],
            isBlankTextValue: value => String(value || '').trim() === ''
        });

        const items = await service.getDefectsNeedingActionRecheck();

        expect(items).toEqual([
            { defect_id: 1, assignee: '담당자1', status: 'Resolved' },
            { defect_id: 3, assignee: '', status: 'Staging' }
        ]);
    });
});
