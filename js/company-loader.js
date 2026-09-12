// =====================================================
// Company Info Loader (Public Web)
// Single Source of Truth via API
// =====================================================

(function () {
    const API_ENDPOINT = '/api/public/company';
    const DEFAULT_COMPANY_NAME = 'CV Karya Perikanan Indonesia';

    let lastLoadedAt = 0;

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

    function resolveField(company, field, lang) {
        if (!company) return '';

        const bilingual = ['name', 'tagline', 'description', 'address', 'whatsapp_message'];
        if (bilingual.includes(field)) {
            const enKey = `${field}_en`;
            if (lang === 'en' && company[enKey]) return company[enKey];
            return company[field] || '';
        }

        if (field === 'whatsapp_number') {
            return company.whatsapp_number || company.whatsapp || company.phone || '';
        }

        if (field === 'phone') {
            return company.phone || company.whatsapp_number || company.whatsapp || '';
        }

        if (field === 'email') {
            return company.email || '';
        }

        if (field === 'operating_hours') {
            return company.operating_hours || '';
        }

        return company[field] || '';
    }

    function normalizeWhatsAppNumber(number) {
        if (!number) return '';
        let digits = String(number).replace(/\D/g, '');
        if (digits.startsWith('0')) {
            digits = `62${digits.slice(1)}`;
        }
        return digits;
    }

    function buildWhatsAppLink(company, lang) {
        const numberRaw = company?.whatsapp_number || company?.whatsapp || company?.phone || '';
        const number = normalizeWhatsAppNumber(numberRaw);
        if (!number) return '';

        const message = resolveField(company, 'whatsapp_message', lang) || '';
        const encoded = message ? encodeURIComponent(message) : '';
        return encoded ? `https://wa.me/${number}?text=${encoded}` : `https://wa.me/${number}`;
    }

    function updateTextFields(company) {
        const lang = getCurrentLanguage();

        document.querySelectorAll('[data-company-field]').forEach(element => {
            const field = element.getAttribute('data-company-field');
            const value = resolveField(company, field, lang);
            if (!value) return;

            const isHtml = element.getAttribute('data-company-html') === 'true';
            if (isHtml) {
                element.innerHTML = value.replace(/\n/g, '<br>');
            } else {
                element.textContent = value;
            }
        });
    }

    function updateAttributes(company) {
        const lang = getCurrentLanguage();

        document.querySelectorAll('[data-company-attr]').forEach(element => {
            const mapping = element.getAttribute('data-company-attr');
            if (!mapping) return;

            const [attr, field] = mapping.split(':');
            if (!attr || !field) return;

            const value = resolveField(company, field, lang);
            if (value) {
                element.setAttribute(attr.trim(), value);
            }
        });
    }

    function updateLinks(company) {
        const lang = getCurrentLanguage();

        document.querySelectorAll('[data-company-href]').forEach(element => {
            const type = element.getAttribute('data-company-href');
            if (!type) return;

            if (type === 'whatsapp') {
                const url = buildWhatsAppLink(company, lang);
                if (url) element.setAttribute('href', url);
            }

            if (type === 'phone') {
                const phone = company?.phone || '';
                if (phone) element.setAttribute('href', `tel:${phone}`);
            }

            if (type === 'email') {
                const email = company?.email || '';
                if (email) element.setAttribute('href', `mailto:${email}`);
            }

            if (type === 'maps') {
                const mapsUrl = company?.google_maps_url || '';
                if (mapsUrl) element.setAttribute('href', mapsUrl);
            }

            if (type === 'instagram') {
                const url = company?.social_instagram || '';
                if (url) element.setAttribute('href', url);
            }

            if (type === 'facebook') {
                const url = company?.social_facebook || '';
                if (url) element.setAttribute('href', url);
            }

            if (type === 'linkedin') {
                const url = company?.social_linkedin || '';
                if (url) element.setAttribute('href', url);
            }
        });
    }

    function updateMeta(company) {
        const lang = getCurrentLanguage();
        const name = resolveField(company, 'name', lang) || DEFAULT_COMPANY_NAME;
        const description = resolveField(company, 'description', lang);
        const tagline = resolveField(company, 'tagline', lang);
        const logoUrl = company?.logo_url || company?.logo_path || '';

        // Update title (replace default name if present)
        if (document.title) {
            if (document.title.includes(DEFAULT_COMPANY_NAME)) {
                document.title = document.title.replace(DEFAULT_COMPANY_NAME, name);
            }
        }

        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription && description) {
            metaDescription.setAttribute('content', description);
        }

        const metaAuthor = document.querySelector('meta[name="author"]');
        if (metaAuthor && name) {
            metaAuthor.setAttribute('content', name);
        }

        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            const ogValue = ogTitle.getAttribute('content') || '';
            if (ogValue.includes(DEFAULT_COMPANY_NAME)) {
                ogTitle.setAttribute('content', ogValue.replace(DEFAULT_COMPANY_NAME, name));
            } else if (tagline) {
                ogTitle.setAttribute('content', `${name} - ${tagline}`);
            }
        }

        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription && description) {
            ogDescription.setAttribute('content', description);
        }

        const twitterTitle = document.querySelector('meta[property="twitter:title"]');
        if (twitterTitle) {
            const tValue = twitterTitle.getAttribute('content') || '';
            if (tValue.includes(DEFAULT_COMPANY_NAME)) {
                twitterTitle.setAttribute('content', tValue.replace(DEFAULT_COMPANY_NAME, name));
            } else if (tagline) {
                twitterTitle.setAttribute('content', `${name} - ${tagline}`);
            }
        }

        const twitterDesc = document.querySelector('meta[property="twitter:description"]');
        if (twitterDesc && description) {
            twitterDesc.setAttribute('content', description);
        }

        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && logoUrl) {
            ogImage.setAttribute('content', logoUrl);
        }

        const twitterImage = document.querySelector('meta[property="twitter:image"]');
        if (twitterImage && logoUrl) {
            twitterImage.setAttribute('content', logoUrl);
        }

        document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => {
            if (logoUrl) link.setAttribute('href', logoUrl);
        });

        document.querySelectorAll('img.logo-image').forEach(img => {
            if (logoUrl) img.setAttribute('src', logoUrl);
        });
    }

    function updateMap(company) {
        const mapIframe = document.querySelector('[data-company-map]');
        if (!mapIframe) return;

        if (company?.google_maps_url) {
            mapIframe.setAttribute('src', company.google_maps_url);
        }

        const lang = getCurrentLanguage();
        const name = resolveField(company, 'name', lang);
        if (name) {
            mapIframe.setAttribute('title', `Lokasi ${name}`);
        }
    }

    function applyCompanyData(company) {
        if (!company || Object.keys(company).length === 0) {
            return;
        }

        window.companyInfo = company;
        updateTextFields(company);
        updateAttributes(company);
        updateLinks(company);
        updateMeta(company);
        updateMap(company);

        window.dispatchEvent(new CustomEvent('companyInfoLoaded', { detail: company }));
    }

    async function fetchCompanyInfo() {
        try {
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const company = await response.json();
            return company || {};
        } catch (error) {
            console.warn('⚠️ Failed to fetch company info:', error.message);
            return window.companyInfo || {};
        }
    }

    async function loadCompanyInfo(force = false) {
        if (window.location.pathname.includes('admin.html')) return;

        const now = Date.now();
        if (!force && now - lastLoadedAt < 2000) {
            if (window.companyInfo) applyCompanyData(window.companyInfo);
            return;
        }

        lastLoadedAt = now;
        const company = await fetchCompanyInfo();
        applyCompanyData(company);
    }

    window.loadCompanyInfo = loadCompanyInfo;

    document.addEventListener('DOMContentLoaded', () => {
        loadCompanyInfo();
    });
})();
