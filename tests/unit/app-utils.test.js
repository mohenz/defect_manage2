import { describe, it, expect } from 'vitest';

const appUtils = require('../../js/utils/app-utils.js');

describe('DefectFlow app utils pagination', () => {
    it('should build a 10-page window for middle groups', () => {
        const result = appUtils.buildPaginationRange(13, 27, 10);

        expect(result.pages).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
        expect(result.hasPreviousGroup).toBe(true);
        expect(result.hasNextGroup).toBe(true);
        expect(result.previousGroupPage).toBe(10);
        expect(result.nextGroupPage).toBe(21);
    });

    it('should clamp current page within available range', () => {
        const result = appUtils.buildPaginationRange(99, 3, 10);

        expect(result.currentPage).toBe(3);
        expect(result.pages).toEqual([1, 2, 3]);
        expect(result.hasNextPage).toBe(false);
    });
});
