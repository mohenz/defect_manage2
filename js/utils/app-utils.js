(function attachDefectFlowAppUtils(global) {
    const appUtils = {
        pct(val, total) {
            return total > 0 ? Math.round((val / total) * 100) : 0;
        },

        getCompletionSignal(rate) {
            if (rate <= 40) {
                return { key: 'red' };
            }

            if (rate <= 80) {
                return { key: 'yellow' };
            }

            return { key: 'green' };
        },

        normalizeScreenUrl(rawUrl) {
            const trimmed = String(rawUrl || '').trim();
            if (!trimmed) {
                return '';
            }

            if (/^(javascript|data):/i.test(trimmed)) {
                return '';
            }

            try {
                const parsedUrl = new URL(trimmed, global.location?.href || trimmed);
                if (!/^https?:$/i.test(parsedUrl.protocol)) {
                    return trimmed;
                }

                parsedUrl.hash = '';
                return parsedUrl.toString();
            } catch (error) {
                return trimmed;
            }
        },

        formatDateKST(isoString, includeTime = true) {
            if (!isoString) return '-';

            try {
                const date = new Date(isoString);
                if (Number.isNaN(date.getTime())) {
                    return isoString;
                }

                const options = {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                };

                if (includeTime) {
                    options.hour = '2-digit';
                    options.minute = '2-digit';
                    options.second = '2-digit';
                    options.hour12 = false;
                }

                return date.toLocaleString('ko-KR', options);
            } catch (error) {
                console.error('[DefectFlowAppUtils.formatDateKST] Failed to format date:', error, isoString);
                return isoString;
            }
        },

        getKSTDateString(isoString) {
            if (!isoString) return '';

            try {
                const date = new Date(isoString);
                const offset = 9 * 60;
                const kstDate = new Date(date.getTime() + (offset * 60 * 1000));
                return kstDate.toISOString().split('T')[0];
            } catch (error) {
                return '';
            }
        },

        truncate(str, len) {
            if (!str) return '-';
            return str.length > len ? `${str.substring(0, len)}...` : str;
        },

        buildPaginationRange(currentPage, totalPages, groupSize = 10) {
            const safeTotalPages = Math.max(1, Number(totalPages) || 1);
            const safeGroupSize = Math.max(1, Number(groupSize) || 10);
            const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), safeTotalPages);
            const startPage = Math.floor((safeCurrentPage - 1) / safeGroupSize) * safeGroupSize + 1;
            const endPage = Math.min(startPage + safeGroupSize - 1, safeTotalPages);

            return {
                currentPage: safeCurrentPage,
                totalPages: safeTotalPages,
                groupSize: safeGroupSize,
                startPage,
                endPage,
                pages: Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index),
                hasPreviousPage: safeCurrentPage > 1,
                hasNextPage: safeCurrentPage < safeTotalPages,
                hasPreviousGroup: startPage > 1,
                hasNextGroup: endPage < safeTotalPages,
                previousGroupPage: Math.max(1, startPage - 1),
                nextGroupPage: Math.min(safeTotalPages, endPage + 1)
            };
        },

        sanitize(value) {
            if (value === null || value === undefined) return '';

            return String(value).replace(/[&<>"']/g, (character) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[character]));
        }
    };

    global.DefectFlowAppUtils = appUtils;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = appUtils;
    }
})(typeof window !== 'undefined' ? window : globalThis);
