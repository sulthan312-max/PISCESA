// =====================================================
// Floating WhatsApp Bubble (Reusable)
// =====================================================

(function () {
    const FALLBACK_CONFIG = {
        phone: '6287808228699',
        messages: {
            id: 'Halo CV Karya Perikanan Indonesia, saya ingin bertanya mengenai produk.',
            en: 'Hello CV Karya Perikanan Indonesia, I would like to ask about your products.'
        }
    };

    const ALLOWED_PAGES = ['produk.html', 'contact.html', 'order.html'];

    function isAllowedPage() {
        if (window.location.pathname.includes('admin.html')) {
            return false;
        }

        const page = window.location.pathname.split('/').pop() || '';
        return ALLOWED_PAGES.includes(page);
    }

    function getCurrentLanguage() {
        if (typeof window.currentLang === 'string') {
            return window.currentLang;
        }

        const stored = localStorage.getItem('lang');
        if (stored === 'id' || stored === 'en') {
            return stored;
        }

        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.toLowerCase().startsWith('en')) {
            return 'en';
        }

        return 'id';
    }

    function normalizeWhatsAppNumber(number) {
        if (!number) return '';
        let digits = String(number).replace(/\D/g, '');
        if (digits.startsWith('0')) {
            digits = `62${digits.slice(1)}`;
        }
        return digits;
    }

    function buildWhatsAppUrl() {
        const lang = getCurrentLanguage();
        const company = window.companyInfo || {};
        const phoneRaw = company.whatsapp_number || company.whatsapp || company.phone || FALLBACK_CONFIG.phone;
        const phone = normalizeWhatsAppNumber(phoneRaw) || FALLBACK_CONFIG.phone;
        const message = (lang === 'en' ? company.whatsapp_message_en : company.whatsapp_message) || FALLBACK_CONFIG.messages[lang] || FALLBACK_CONFIG.messages.id;
        const encoded = encodeURIComponent(message);
        return `https://wa.me/${phone}?text=${encoded}`;
    }

    function getIconSvg() {
        return `
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M19.11 17.54c-.28-.14-1.65-.82-1.91-.92-.26-.1-.45-.14-.64.14-.19.28-.73.92-.9 1.11-.16.19-.33.21-.61.07-.28-.14-1.2-.44-2.28-1.4-.84-.75-1.4-1.67-1.57-1.95-.16-.28-.02-.43.12-.57.12-.12.28-.33.42-.5.14-.16.19-.28.28-.47.1-.19.05-.36-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49-.16-.01-.36-.01-.55-.01s-.5.07-.76.36c-.26.28-1 1-1 2.45s1.02 2.85 1.16 3.05c.14.19 2 3.06 4.84 4.29.68.29 1.21.46 1.62.59.68.22 1.29.19 1.77.12.54-.08 1.65-.67 1.88-1.31.23-.64.23-1.19.16-1.31-.07-.12-.26-.19-.54-.33z"/>
                <path fill="currentColor" d="M16 3C9.38 3 4 8.38 4 15c0 2.08.54 4.08 1.56 5.86L4 29l8.35-1.53C14.1 28.17 15.04 28.3 16 28.3c6.62 0 12-5.38 12-12S22.62 3 16 3zm0 23.1c-.88 0-1.74-.12-2.56-.35l-.59-.16-4.96.91.94-4.83-.18-.62A10.9 10.9 0 0 1 5.1 15C5.1 9.86 9.86 5.1 16 5.1S26.9 9.86 26.9 15 22.14 26.1 16 26.1z"/>
            </svg>
        `;
    }

    function injectBubble() {
        if (!isAllowedPage()) {
            return;
        }

        if (document.querySelector('.whatsapp-bubble')) {
            return;
        }

        const link = document.createElement('a');
        link.className = 'whatsapp-bubble';
        link.href = buildWhatsAppUrl();
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('aria-label', 'Chat WhatsApp');
        link.innerHTML = getIconSvg();

        link.addEventListener('click', () => {
            link.classList.add('whatsapp-bubble--active');
            setTimeout(() => link.classList.remove('whatsapp-bubble--active'), 150);
        });

        document.body.appendChild(link);
    }

    function updateBubbleLink() {
        const link = document.querySelector('.whatsapp-bubble');
        if (link) {
            link.href = buildWhatsAppUrl();
        }
    }

    function hookLanguageSwitch() {
        if (typeof window.setLanguage !== 'function') {
            return;
        }

        if (window.setLanguage.__whatsappWrapped) {
            return;
        }

        const originalSetLanguage = window.setLanguage;
        const wrapped = function () {
            const result = originalSetLanguage.apply(this, arguments);
            updateBubbleLink();
            return result;
        };

        wrapped.__whatsappWrapped = true;
        window.setLanguage = wrapped;
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectBubble();
        updateBubbleLink();
        hookLanguageSwitch();
    });

    window.addEventListener('companyInfoLoaded', () => {
        updateBubbleLink();
    });

    window.addEventListener('storage', (event) => {
        if (event.key === 'lang') {
            updateBubbleLink();
        }
    });
})();
