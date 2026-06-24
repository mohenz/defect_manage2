import { describe, expect, it } from 'vitest';
import storageQueryUtils from '../../js/utils/storage-query-utils.js';

function createQueryRecorder() {
    const calls = [];
    const query = {};

    ['eq', 'ilike', 'in', 'or', 'gte', 'lte'].forEach(methodName => {
        query[methodName] = (...args) => {
            calls.push([methodName, ...args]);
            return query;
        };
    });

    return {
        query,
        calls
    };
}

describe('storage-query-utils', () => {
    it('defect id와 screen path 필터를 정규화한다', () => {
        expect(storageQueryUtils.normalizeDefectIdFilter(' 42 ')).toBe(42);
        expect(storageQueryUtils.normalizeDefectIdFilter('A-42')).toBeNull();
        expect(storageQueryUtils.normalizeScreenPathValue(' 주문　> 결제 >  승인 ')).toBe('주문 > 결제 > 승인');
        expect(storageQueryUtils.parseScreenPathFilter(' 주문 > 결제 > 승인 ')).toEqual({
            menuName: '주문 > 결제',
            screenName: '승인'
        });
    });

    it('결함 목록 필터를 query 체인에 일관되게 적용한다', () => {
        const { query, calls } = createQueryRecorder();

        const result = storageQueryUtils.applyDefectFilters(query, {
            defectId: '101',
            severity: 'High',
            status: 'Open',
            title: '로그인',
            stepsToRepro: '재현절차',
            testType: 'WEB',
            enabledTestTypes: ['WEB', 'API'],
            identificationUnassigned: true,
            screenPath: '회원 > 로그인',
            creator: '진아',
            assigneeUnassigned: true,
            dateStart: '2026-04-01',
            dateEnd: '2026-04-02'
        });

        expect(result).toBe(query);
        expect(calls).toEqual([
            ['eq', 'defect_id', 101],
            ['eq', 'severity', 'High'],
            ['eq', 'status', 'Open'],
            ['ilike', 'title', '%로그인%'],
            ['ilike', 'steps_to_repro', '%재현절차%'],
            ['eq', 'test_type', 'WEB'],
            ['in', 'test_type', ['WEB', 'API']],
            ['or', 'defect_identification.is.null,defect_identification.eq.'],
            ['eq', 'menu_name', '회원'],
            ['eq', 'screen_name', '로그인'],
            ['ilike', 'creator', '%진아%'],
            ['or', 'assignee.is.null,assignee.eq.'],
            ['gte', 'created_at', '2026-04-01T00:00:00'],
            ['lte', 'created_at', '2026-04-02T23:59:59']
        ]);
    });

    it('조치 미완료 프리셋은 상태 그룹 in 조건으로 적용한다', () => {
        const { query, calls } = createQueryRecorder();

        storageQueryUtils.applyDefectFilters(query, {
            statusPreset: '__NOT_COMPLETED__',
            status: 'Closed'
        });

        expect(calls).toEqual([
            ['in', 'status', ['Open', 'In Progress', 'Reopened']]
        ]);
    });
});
