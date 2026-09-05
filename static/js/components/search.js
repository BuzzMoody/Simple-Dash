import { state, setState } from '../state.js';
import { checkUrlVisibility } from './services.js';

let listLayoutTimeout = null;

export const applySearchFilter = () => {
    const term = state.searchQuery.toLowerCase().trim();
    let visibleCount = 0;
    const servicesContainer = document.getElementById('services-container');

    document.querySelectorAll('.service-card, .list-row:not(.list-header)').forEach(card => {
        const desc = card.getAttribute('data-desc') || '';
        const nameEl = card.querySelector('.service-name, .list-col.name');
        const text = ((nameEl ? nameEl.textContent : card.textContent) + ' ' + desc).toLowerCase();

        let category = (card.getAttribute('data-category') || '').toLowerCase();
        const group = card.closest('.group');
        if (group && !category) {
            const titleSpan = group.querySelector('.group-title span');
            if (titleSpan) category = titleSpan.textContent.toLowerCase();
        }

        if (!term || text.includes(term) || category.includes(term)) {
            if (card.classList.contains('search-hidden')) {
                card.classList.remove('search-hidden');
                card.style.display = '';
            }
            visibleCount++;
        } else {
            if (!card.classList.contains('search-hidden')) {
                card.classList.add('search-hidden');
                card.style.display = 'none';
            }
        }
    });

    if (state.layout === 'list') {
        const evaluateLayout = (isDelayed) => {
            if (window.innerWidth < 1200) return;
            const table = document.querySelector('.list-table');
            if (!table) return;

            table.classList.add('single-col');
            if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
                table.classList.remove('single-col');

                if (isDelayed) {
                    const visibleRows = Array.from(table.querySelectorAll('.list-row:not(.list-header)')).filter(row => row.style.display !== 'none' && !row.classList.contains('search-hidden'));
                    visibleRows.sort((a, b) => {
                        const indexA = parseInt(a.style.getPropertyValue('--row-index') || 0);
                        const indexB = parseInt(b.style.getPropertyValue('--row-index') || 0);
                        return indexA - indexB;
                    });

                    const hasHeader = table.querySelector('.list-header') ? 1 : 0;
                    const totalCells = visibleRows.length + hasHeader;
                    const leftItemsCount = Math.max(0, Math.ceil(totalCells / 2) - hasHeader);
                    const rightItemsCount = visibleRows.length - leftItemsCount;
                    const maxRows = Math.max(leftItemsCount, rightItemsCount);

                    visibleRows.forEach(row => row.classList.remove('left-column', 'last-in-column'));

                    for (let i = 0; i < leftItemsCount; i++) {
                        visibleRows[i].classList.add('left-column');
                        if (i === leftItemsCount - 1) visibleRows[i].classList.add('last-in-column');
                    }
                    for (let i = 0; i < rightItemsCount; i++) {
                        const rightIndex = leftItemsCount + i;
                        if (i === rightItemsCount - 1) visibleRows[rightIndex].classList.add('last-in-column');
                    }

                    const interleaved = [];
                    for (let i = 0; i < maxRows; i++) {
                        if (i < rightItemsCount) interleaved.push(visibleRows[leftItemsCount + i]);
                        if (i < leftItemsCount) interleaved.push(visibleRows[i]);
                    }

                    interleaved.forEach(row => {
                        table.appendChild(row);
                    });
                }
            }
            checkUrlVisibility();
        };
        evaluateLayout(false);
        clearTimeout(listLayoutTimeout);
        listLayoutTimeout = setTimeout(() => evaluateLayout(true), 320);
    }

    document.querySelectorAll('.group').forEach(group => {
        const visibleCards = Array.from(group.querySelectorAll('.service-card')).filter(c => !c.classList.contains('search-hidden'));
        if (visibleCards.length > 0 || !term) {
            if (group.classList.contains('search-hidden')) {
                group.classList.remove('search-hidden');
                group.style.display = '';
            }
        } else {
            if (!group.classList.contains('search-hidden')) {
                group.classList.add('search-hidden');
                group.style.display = 'none';
            }
        }
    });

    let noRes = document.getElementById('no-results-msg');
    if (visibleCount === 0 && term) {
        if (!noRes && servicesContainer) {
            noRes = document.createElement('div');
            noRes.id = 'no-results-msg';
            noRes.innerHTML = `
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="2" width="18" height="20" rx="2" ry="2"></rect>
                        <line x1="3" y1="8" x2="21" y2="8"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <circle cx="7" cy="5" r="1"></circle>
                        <line x1="11" y1="5" x2="17" y2="5"></line>
                        <circle cx="7" cy="11.5" r="1"></circle>
                        <line x1="11" y1="11.5" x2="17" y2="11.5"></line>
                        <circle cx="7" cy="18" r="1"></circle>
                        <line x1="11" y1="18" x2="17" y2="18"></line>
                    </svg>
                </div>
                <div class="empty-state-text">No services match your search</div>
            `;
            servicesContainer.appendChild(noRes);
        }
        if (noRes) noRes.style.display = 'flex';
    } else if (noRes) {
        noRes.style.display = 'none';
    }
};

export const initSearch = () => {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    if (searchClear && searchInput) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            setState({ searchQuery: '' });
            searchClear.style.display = 'none';
            applySearchFilter();
            searchInput.focus();
        });
    }

    let searchTimeout = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (searchClear) {
                searchClear.style.display = e.target.value.length > 0 ? 'flex' : 'none';
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                setState({ searchQuery: e.target.value });
                applySearchFilter();
            }, 150);
        });
    }

    // Global keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            if (searchInput) searchInput.focus();
            return;
        }

        const isCardFocused = document.activeElement && document.activeElement.hasAttribute('data-url');

        if (document.activeElement === searchInput && e.key === 'ArrowDown') {
            e.preventDefault();
            const firstCard = document.querySelector('[data-url]');
            if (firstCard) firstCard.focus();
            return;
        }

        if (isCardFocused) {
            const cards = Array.from(document.querySelectorAll('[data-url]'));
            const currentIndex = cards.indexOf(document.activeElement);
            if (currentIndex === -1) return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentIndex + 1 < cards.length) cards[currentIndex + 1].focus();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentIndex - 1 >= 0) {
                    cards[currentIndex - 1].focus();
                } else if (searchInput) {
                    searchInput.focus();
                }
            }
            return;
        }

        const isInputFocused = document.activeElement === searchInput;

        if (e.key === 'Escape') {
            if (searchInput && searchInput.value !== '') {
                searchInput.value = '';
                setState({ searchQuery: '' });
                if (searchClear) searchClear.style.display = 'none';
                applySearchFilter();
            }
            if (isInputFocused && searchInput) {
                searchInput.blur();
            }
            return;
        }

        // Capture alphanumeric typing to search box
        if (!isInputFocused && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && searchInput) {
            if (e.key === ' ' && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A')) {
                return;
            }
            e.preventDefault();
            searchInput.focus();
            searchInput.value += e.key;
            if (searchClear) searchClear.style.display = 'flex';
            setState({ searchQuery: searchInput.value });
            applySearchFilter();
            return;
        }

        // Capture backspace
        if (!isInputFocused && e.key === 'Backspace' && searchInput) {
            e.preventDefault();
            searchInput.focus();
            if (searchInput.value.length > 0) {
                searchInput.value = searchInput.value.slice(0, -1);
                if (searchClear) searchClear.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
                setState({ searchQuery: searchInput.value });
                applySearchFilter();
            }
            return;
        }
    });
};
