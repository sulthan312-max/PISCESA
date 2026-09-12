// =====================================================
// CV KARYA PERIKANAN INDONESIA - JavaScript
// Main JavaScript File
// =====================================================

// =====================================================
// LANGUAGE DETECTION & MANAGEMENT SYSTEM (GLOBAL)
// =====================================================

// Global language variable
let currentLang = 'id';

// Initialize language system once on page load
function initLanguageSystem() {
    // Skip if on admin page
    if (window.location.pathname.includes('admin.html')) {
        currentLang = 'id';
        console.log('🔒 Admin page - language locked to Indonesian');
        return;
    }

    // Priority 1: Check localStorage
    const savedLang = localStorage.getItem('lang');
    if (savedLang && (savedLang === 'id' || savedLang === 'en')) {
        currentLang = savedLang;
        console.log(`🌍 Language loaded from localStorage: ${currentLang}`);
    } else {
        // Priority 2: Auto-detect from browser language
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'id' || browserLang === 'in') {
            currentLang = 'id';
        } else {
            currentLang = 'en';
        }
        console.log(`🌍 Language auto-detected: ${currentLang}`);
        localStorage.setItem('lang', currentLang);
    }

    // Apply language to page
    applyLanguage();
    if (typeof window.loadCompanyInfo === 'function') {
        window.loadCompanyInfo();
    }
    
    // Create and inject language switch UI
    createLanguageSwitchUI();
}

// Apply language to all elements with data-i18n attribute
function applyLanguage() {
    const lang = currentLang;
    const translations = i18n[lang];

    if (!translations) {
        console.warn(`⚠️ Language pack for '${lang}' not found`);
        return;
    }

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            // Always directly update OPTION, BUTTON, A, and elements with no children
            if (element.tagName === 'OPTION' || element.tagName === 'BUTTON' || element.tagName === 'A' || element.children.length === 0) {
                element.textContent = translations[key];
                if (element.tagName === 'OPTION') {
                    console.log(`✨ Translated option: "${key}" -> "${translations[key]}"`);
                }
            } else {
                // For elements with children, only update text nodes
                let foundText = false;
                for (let node of element.childNodes) {
                    if (node.nodeType === 3) { // Text node
                        node.textContent = translations[key];
                        foundText = true;
                        break;
                    }
                }
            }
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[key]) {
            element.placeholder = translations[key];
        }
    });

    console.log(`✅ Applied language: ${lang}`);
}

// Switch language manually
function setLanguage(lang) {
    if (lang !== 'id' && lang !== 'en') {
        console.warn(`⚠️ Invalid language: ${lang}`);
        return;
    }

    // Skip if on admin page
    if (window.location.pathname.includes('admin.html')) {
        console.log('🔒 Admin page - language switch disabled');
        return;
    }

    currentLang = lang;
    localStorage.setItem('lang', currentLang);
    console.log(`🔄 Language switched to: ${currentLang}`);

    // Apply language to page
    applyLanguage();
    
    // Update language switch UI
    updateLanguageSwitchUI();
    
    // Refresh product list AFTER language is applied
    if (document.getElementById('produk')) {
        setTimeout(() => loadAvailableProducts(), 100);
    }

    // Refresh home products preview if available
    if (typeof window.loadHomeProducts === 'function') {
        setTimeout(() => window.loadHomeProducts(), 100);
    }

    if (typeof window.loadCompanyInfo === 'function') {
        setTimeout(() => window.loadCompanyInfo(true), 100);
    }
}

// Create language switch UI dynamically
function createLanguageSwitchUI() {
    // Find navbar menu
    const navMenu = document.getElementById('navMenu');
    if (!navMenu) {
        console.warn('⚠️ navMenu not found - language switch UI not created');
        return;
    }

    // Check if language switch already exists
    if (document.getElementById('langSwitchContainer')) {
        console.log('✅ Language switch already exists, updating...');
        updateLanguageSwitchUI();
        return;
    }

    // Create language switch HTML (removed inline styles, using CSS classes)
    const langSwitchHTML = `
        <li id="langSwitchContainer">
            <span id="langID" onclick="setLanguage('id')">ID</span>
            <span style="color: #999;">|</span>
            <span id="langEN" onclick="setLanguage('en')">EN</span>
        </li>
    `;

    // Append to navbar menu
    navMenu.insertAdjacentHTML('beforeend', langSwitchHTML);
    console.log('✅ Language switch UI created');
    
    // Update styling
    updateLanguageSwitchUI();
}

// Update language switch UI styling
function updateLanguageSwitchUI() {
    const idBtn = document.getElementById('langID');
    const enBtn = document.getElementById('langEN');

    if (idBtn && enBtn) {
        // Remove active class from both
        idBtn.classList.remove('active');
        enBtn.classList.remove('active');
        
        // Add active class to current language
        if (currentLang === 'id') {
            idBtn.classList.add('active');
            idBtn.style.opacity = '1';
            enBtn.style.opacity = '0.6';
        } else {
            enBtn.classList.add('active');
            enBtn.style.opacity = '1';
            idBtn.style.opacity = '0.6';
        }
        
        console.log(`🌍 Language switch updated: ${currentLang}`);
    } else {
        console.warn('⚠️ Language switch buttons not found');
    }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageSystem);
} else {
    // DOM is already loaded
    initLanguageSystem();
}

// =====================================================
// SUPABASE CONFIGURATION
// =====================================================

// Initialize Supabase when SDK is loaded
if (typeof window !== 'undefined') {
    const checkSupabaseSDK = setInterval(() => {
        if (window.supabase && window.supabase.createClient && !window.supabaseClient) {
            clearInterval(checkSupabaseSDK);

            const SUPABASE_URL = 'https://pmegvhlyabddfxxoyjrq.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZWd2aGx5YWJkZGZ4eG95anJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0Mjg0MDgsImV4cCI6MjA4NTAwNDQwOH0.xUN2pqzlxoGwCfzx5mua3XEEmlkyYUv3Y8ZY64GKGHw';

            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized');
            
            // Load products after Supabase is ready
            loadAvailableProducts();
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => clearInterval(checkSupabaseSDK), 10000);
}

// =====================================================
// SUPABASE HELPER FUNCTIONS
// =====================================================

// Example: Fetch data from a table
async function fetchFromTable(tableName) {
    try {
        const { data, error } = await window.supabaseClient
            .from(tableName)
            .select('*');
        
        if (error) throw error;
        console.log(`Data from ${tableName}:`, data);
        return data;
    } catch (error) {
        console.error(`Error fetching from ${tableName}:`, error.message);
        return null;
    }
}

// Example: Insert data to a table
async function insertToTable(tableName, data) {
    try {
        const { data: result, error } = await window.supabaseClient
            .from(tableName)
            .insert(data)
            .select();
        
        if (error) throw error;
        console.log(`Data inserted to ${tableName}:`, result);
        return result;
    } catch (error) {
        console.error(`Error inserting to ${tableName}:`, error.message);
        return null;
    }
}

// =====================================================
// LOAD AVAILABLE PRODUCTS FOR ORDER FORM
// =====================================================
async function loadAvailableProducts() {
    try {
        // Wait for Supabase client with timeout
        let retries = 0;
        const maxRetries = 100; // Wait up to 10 seconds
        
        while (!window.supabaseClient && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        if (!window.supabaseClient) {
            console.warn('⚠️ Supabase client failed to initialize after timeout');
            return;
        }

        const produkSelect = document.getElementById('produk');
        if (!produkSelect) {
            console.warn('⚠️ Product select element not found on this page');
            return;
        }

        console.log('📦 Fetching available products from Supabase...');
        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('id, name, name_en, available')
            .eq('available', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('❌ Error loading available products:', error);
            return;
        }

        // Get current selected value to restore later
        const currentValue = produkSelect.value;
        
        // Remove all product options (keep default option only)
        const options = produkSelect.querySelectorAll('option');
        options.forEach((option, index) => {
            if (index > 0) { // Keep first option (default)
                option.remove();
            }
        });

        // Add available products with language-specific names
        if (products && products.length > 0) {
            products.forEach(product => {
                const option = document.createElement('option');
                // Use name_en if English is selected and name_en exists, otherwise use name
                const displayName = (currentLang === 'en' && product.name_en) ? product.name_en : product.name;
                option.value = product.name; // Keep original name as value for backend
                option.textContent = displayName;
                option.setAttribute('data-name-id', product.name);
                option.setAttribute('data-name-en', product.name_en || product.name);
                produkSelect.appendChild(option);
            });
            console.log(`✅ Loaded ${products.length} available products for order form (lang: ${currentLang})`);
        } else {
            console.warn('⚠️ No available products found in database');
        }
        
        // Restore previously selected value if it's still available
        if (currentValue) {
            const optionExists = Array.from(produkSelect.options).some(opt => opt.value === currentValue);
            if (optionExists) {
                produkSelect.value = currentValue;
            }
        }
        
        // Re-apply language to ensure default option text is translated
        if (document.getElementById('produk')) {
            applyLanguage();
        }
    } catch (error) {
        console.error('❌ Error in loadAvailableProducts:', error);
    }
}

// Re-load products when page becomes visible (catches admin changes)
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && document.getElementById('produk')) {
            console.log('📄 Page became visible, refreshing product list...');
            setTimeout(loadAvailableProducts, 500);
        }
    });
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // =====================================================
    // MOBILE MENU TOGGLE
    // =====================================================
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a nav link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            const isClickInsideNav = navMenu.contains(event.target);
            const isClickOnHamburger = hamburger.contains(event.target);
            
            if (!isClickInsideNav && !isClickOnHamburger && navMenu.classList.contains('active')) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }
    
    // =====================================================
    // LOAD AVAILABLE PRODUCTS (for order form)
    // =====================================================
    loadAvailableProducts();
    
    // =====================================================
    // NAVBAR SCROLL EFFECT
    // =====================================================
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        // Add shadow on scroll
        if (currentScroll > 50) {
            navbar.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.15)';
        } else {
            navbar.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        }
        
        lastScroll = currentScroll;
    });
    
    // =====================================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // =====================================================
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if href is just "#"
            if (href === '#') return;
            
            const target = document.querySelector(href);
            
            if (target) {
                e.preventDefault();
                const navHeight = navbar.offsetHeight;
                const targetPosition = target.offsetTop - navHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // =====================================================
    // ORDER FORM HANDLING (WhatsApp Integration)
    // =====================================================
    const orderForm = document.getElementById('orderForm');
    
    if (orderForm) {
        orderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form values
            const nama = document.getElementById('nama').value.trim();
            const whatsapp = document.getElementById('whatsapp').value.trim();
            const email = document.getElementById('email').value.trim();
            const produk = document.getElementById('produk').value;
            const jumlah = document.getElementById('jumlah').value;
            const alamat = document.getElementById('alamat').value.trim();
            const catatan = document.getElementById('catatan').value.trim();
            
            // Validate required fields
            if (!nama || !whatsapp || !produk || !jumlah || !alamat) {
                alert('Mohon lengkapi semua field yang wajib diisi (*)');
                return;
            }
            
            // Validate phone number (basic)
            const phoneRegex = /^[0-9]{10,13}$/;
            const cleanPhone = whatsapp.replace(/[-\s]/g, '');
            
            if (!phoneRegex.test(cleanPhone)) {
                alert('Nomor WhatsApp tidak valid. Gunakan format: 08xxxxxxxxxx');
                return;
            }
            
            // Format WhatsApp message
            let message = `*PESANAN BARU - CV KARYA PERIKANAN INDONESIA*\n\n`;
            message += `📋 *Detail Pesanan:*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `👤 Nama: ${nama}\n`;
            message += `📱 WhatsApp: ${whatsapp}\n`;
            
            if (email) {
                message += `📧 Email: ${email}\n`;
            }
            
            message += `\n🐟 *Produk:* ${produk}\n`;
            message += `📦 *Jumlah:* ${jumlah} kg\n`;
            message += `\n📍 *Alamat Pengiriman:*\n${alamat}\n`;
            
            if (catatan) {
                message += `\n📝 *Catatan:*\n${catatan}\n`;
            }
            
            message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
            message += `Mohon konfirmasi ketersediaan dan harga. Terima kasih! 🙏`;
            
            // Simpan ke Supabase
            try {
                if (!window.supabaseClient) {
                    throw new Error('Supabase client tidak tersedia');
                }

                const { data, error } = await window.supabaseClient
                    .from('orders')
                    .insert({
                        customer_name: nama,
                        whatsapp: whatsapp,
                        email: email || null,
                        product: produk,
                        quantity: jumlah,
                        address: alamat,
                        note: catatan || null,
                        status: 'pending'
                    });

                if (error) {
                    console.error('Error inserting order:', error);
                    throw error;
                }

                console.log('✅ Order berhasil disimpan ke Supabase dengan status: pending', data);
            } catch (err) {
                console.error('❌ Gagal menyimpan pesanan ke Supabase:', err);
                alert('⚠️ Peringatan: Pesanan gagal disimpan ke database.\n\nUkuran file mungkin terlalu besar atau ada masalah koneksi.\n\nSilahkan lanjutkan dengan WhatsApp untuk detail pesanan Anda.');
            }

            // Encode message for URL
            const encodedMessage = encodeURIComponent(message);
            
            // WhatsApp number (format: country code + number without leading 0)
            const waNumber = '6287808228699';
            
            // Create WhatsApp URL
            const waURL = `https://wa.me/${waNumber}?text=${encodedMessage}`;
            
            // Open WhatsApp in new tab
            window.open(waURL, '_blank');
            
            // Show success message
            alert('Anda akan diarahkan ke WhatsApp untuk mengirim pesanan');
            
            // Optional: Reset form after submit
            // orderForm.reset();
        });
        
        // Real-time phone number formatting
        const whatsappInput = document.getElementById('whatsapp');
        if (whatsappInput) {
            whatsappInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                
                // Limit to 13 digits
                if (value.length > 13) {
                    value = value.slice(0, 13);
                }
                
                // Format: 08xx-xxxx-xxxx
                if (value.length > 4 && value.length <= 8) {
                    value = value.slice(0, 4) + '-' + value.slice(4);
                } else if (value.length > 8) {
                    value = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8);
                }
                
                e.target.value = value;
            });
        }
        
        // Number input validation
        const jumlahInput = document.getElementById('jumlah');
        if (jumlahInput) {
            jumlahInput.addEventListener('input', function(e) {
                if (e.target.value < 1) {
                    e.target.value = 1;
                }
            });
        }
    }
    
    // =====================================================
    // SCROLL ANIMATIONS (Fade In on Scroll)
    // =====================================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.product-card, .vm-card, .stat-card, .contact-item');
    
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // =====================================================
    // BACK TO TOP BUTTON
    // =====================================================
    const createBackToTopButton = () => {
        const button = document.createElement('button');
        button.innerHTML = '↑';
        button.className = 'back-to-top';
        button.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--primary-blue);
            color: white;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 999;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        `;
        
        document.body.appendChild(button);
        
        // Show/hide button on scroll
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                button.style.opacity = '1';
                button.style.visibility = 'visible';
            } else {
                button.style.opacity = '0';
                button.style.visibility = 'hidden';
            }
        });
        
        // Scroll to top on click
        button.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.background = 'var(--dark-blue)';
            button.style.transform = 'translateY(-5px)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = 'var(--primary-blue)';
            button.style.transform = 'translateY(0)';
        });
    };
    
    createBackToTopButton();
    
    // =====================================================
    // LOADING ANIMATION
    // =====================================================
    window.addEventListener('load', function() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            document.body.style.opacity = '1';
        }, 100);
    });
    
    // =====================================================
    // PREVENT FORM DOUBLE SUBMISSION
    // =====================================================
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                setTimeout(() => {
                    submitBtn.disabled = false;
                }, 3000);
            }
        });
    });
    
    // =====================================================
    // CONSOLE MESSAGE
    // =====================================================
    console.log('%c CV Karya Perikanan Indonesia ', 'background: #0066B3; color: white; font-size: 16px; padding: 10px;');
    console.log('%c Website Company Profile ', 'background: #004C8C; color: white; font-size: 12px; padding: 5px;');
    console.log('%c Pengolahan Limbah Perikanan Berkualitas ', 'color: #0066B3; font-size: 12px;');
    
});

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Format currency (IDR)
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Format phone number
function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{4})(\d{4})(\d{4})$/);
    
    if (match) {
        return match[1] + '-' + match[2] + '-' + match[3];
    }
    
    return phone;
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Copy to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Berhasil disalin ke clipboard!');
        }).catch(err => {
            console.error('Gagal menyalin:', err);
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            alert('Berhasil disalin ke clipboard!');
        } catch (err) {
            console.error('Gagal menyalin:', err);
        }
        
        document.body.removeChild(textArea);
    }
}

// Get current year (for copyright)
function getCurrentYear() {
    return new Date().getFullYear();
}

// Update copyright year
window.addEventListener('load', function() {
    const copyrightElements = document.querySelectorAll('.footer-bottom p');
    copyrightElements.forEach(element => {
        const text = element.textContent;
        if (text.includes('2026')) {
            element.textContent = text.replace('2026', getCurrentYear());
        }
    });
});
// =====================================================
// GALLERY CAROUSEL
// =====================================================
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
const totalSlides = slides.length;

function moveCarousel(direction) {
    currentSlide += direction;
    
    // Loop carousel
    if (currentSlide >= totalSlides) {
        currentSlide = 0;
    } else if (currentSlide < 0) {
        currentSlide = totalSlides - 1;
    }
    
    // Update carousel position
    const carouselTrack = document.getElementById('carouselTrack');
    if (carouselTrack) {
        carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
}

// =====================================================
// LOAD FOOTER COMPANY INFO FROM SUPABASE
// =====================================================
async function loadFooterCompanyInfo() {
    try {
        // Wait for Supabase to be available
        for (let i = 0; i < 50; i++) {
            if (window.supabaseClient) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.supabaseClient) {
            console.warn('⚠️ Supabase client not available, using footer defaults');
            return;
        }

        // Fetch company info
        const { data, error } = await window.supabaseClient
            .from('company')
            .select('*')
            .limit(1)
            .single();

        if (error || !data) {
            console.warn('⚠️ Company info not found in Supabase, using footer defaults');
            return;
        }

        // Update footer with company info
        if (data.name && document.getElementById('footerCompanyName')) {
            document.getElementById('footerCompanyName').textContent = data.name;
        }
        
        if (data.description && document.getElementById('footerCompanyDesc')) {
            document.getElementById('footerCompanyDesc').textContent = data.description;
        }
        
        if (data.address && document.getElementById('footerAddress')) {
            document.getElementById('footerAddress').innerHTML = `<i class="fas fa-map-marker-alt"></i> <span>${data.address}</span>`;
        }
        
        if (data.phone && document.getElementById('footerPhone')) {
            document.getElementById('footerPhone').innerHTML = `<i class="fas fa-phone"></i> <span>${data.phone}</span>`;
        }
        
        if (data.operating_hours && document.getElementById('footerHours')) {
            document.getElementById('footerHours').innerHTML = `<i class="fas fa-clock"></i> <span>${data.operating_hours}</span>`;
        }

        console.log('✅ Footer company info loaded from Supabase');

    } catch (error) {
        console.warn('⚠️ Error loading footer company info:', error.message);
        // Silently fail - use defaults
    }
}

// Load footer info when page loads
document.addEventListener('DOMContentLoaded', loadFooterCompanyInfo);
// Also try loading after a short delay if DOMContentLoaded already fired
if (document.readyState === 'complete') {
    setTimeout(loadFooterCompanyInfo, 500);
}

