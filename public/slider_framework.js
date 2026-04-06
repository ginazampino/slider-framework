(() => {
    function simulateLoading(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    };
    /* ==================================
        Filter Allowed Pages
    ================================== */
    const ALLOWED_PAGES = new Set(['movies', 'shows']); // NOTE: Faster than Array
    const pageName = getPageName(window.location.pathname);

    if (!ALLOWED_PAGES.has(pageName)) return;

    function getPageName(path) {
        const extractedName = path
            .replace(/^\/+/, '')
            .replace(/\.(html|aspx)$/, '');
        return extractedName || '';
    }

    /* ==================================
        Build Placeholders
    ================================== */
    const sliderContainerId = 'sliders';
    const placeholderAmounts = { movies: 3, shows: 2 };
    const placeholderSlideAmount = 5;

    buildPlaceholderHtml(pageName);
    init(pageName);

    function buildPlaceholderHtml(page) {
        const sliderContainer = document.getElementById(sliderContainerId);

        if (!sliderContainer) {
            console.warn(`(Slider Framework) Expected container "#${sliderContainerId}" not found on page "${page}". Skipping placeholder injection.`);
            return;
        }

        const placeholderSliderAmount = placeholderAmounts[page] || 1;
        const placeholderSliders = [];

        for (let i = 0; i < placeholderSliderAmount; i++) {
            placeholderSliders.push(generatePlaceholderSlider(generatePlaceholderSlides(placeholderSlideAmount)));
        }

        sliderContainer.innerHTML = placeholderSliders.join('');
    }

    function generatePlaceholderSlides(amount) {
        const slides = [];

        for (let i = 0; i < amount; i++) {
            slides.push(`
                <div class="swiper-placeholder-slide">
                    <p>Loading...</p>
                </div>
            `);
        }

        return slides.join('');
    }

    function generatePlaceholderSlider(slidesHtml) {
        return `
            <div class="band">
                <div class="swiper">
                    <div class="swiper-placeholder-wrapper">
                        ${slidesHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /* ==================================
        Fetch JSON Files
    ================================== */
    async function fetchJson(path) {
        const response = await fetch(path);

        if (!response.ok) {
            console.log(`(Slider Framework) Failed to fetch (${response.status}): ${response.url}`);
            return;
        }

        return response.json();
    }

    /* ==================================
        Swiper Options
    ================================== */
    const DEFAULT_SWIPER_OPTIONS = {
        a11y: true,
        keyboard: true,
        simulateTouch: true,
        speed: 500,
        autoplay: false,
        rewind: true,
        loop: false,
        initialSlide: 0,
        updateOnWindowResize: true,
        slidesPerView: 'auto',
        slidesPerGroup: 1,
        slidesPerGroupAuto: false,
        centeredSlides: true,
        centeredSlidesBounds: true,
        centerInsufficientSlides: true,
        spaceBetween: 10
    };

    const SLIDER_MODE_OPTIONS = {
        single: {
            slidesPerView: 'auto',
            slidesPerGroup: 1,
            slidesPerGroupAuto: false,
            centeredSlides: true,
            centeredSlidesBounds: true,
            centerInsufficientSlides: true
        },
        group: {
            slidesPerView: 'auto',
            slidesPerGroup: 1,
            slidesPerGroupAuto: true,
            centeredSlides: false,
            centeredSlidesBounds: false,
            centerInsufficientSlides: true
        },
        page: {
            slidesPerView: 1,
            slidesPerGroup: 1,
            slidesPerGroupAuto: false,
            centeredSlides: false,
            centeredSlidesBounds: false,
            centerInsufficientSlides: false
        }
    };

    /* ==================================
        Initiate Production Page
    ================================== */
    async function init(page) {
        await simulateLoading(2000);
        
        try {
            const [htmlTemplates, sliderData, pageConfig] = await Promise.all([
                fetchJson('/config/templates.json'),
                fetchJson('/data/sliders.json'),
                fetchJson(`/config/${page}.config.json`)
            ]);

            buildProductionHtml(htmlTemplates, sliderData, pageConfig);

            const needsSwiper = pageConfig.sliders.some((s) => s.sliderLibrary !== 'Marquee6k');
            const needsMarquee = pageConfig.sliders.some((s) => s.sliderLibrary === 'Marquee6k');

            const assetPromises = [];
            if (needsSwiper) assetPromises.push(addSwiperAssets());
            if (needsMarquee) assetPromises.push(addMarqueeAssets());
            await Promise.all(assetPromises);

            if (needsSwiper) initSwiper(pageConfig);
            if (needsMarquee) initMarquee(pageConfig);
        } catch (error) {
            console.error(`(Slider Framework) Failed to fetch required config file(s) from server:`, error);
        }
    }

    /* ==================================
        Build Production Sliders
    ================================== */
    function buildSlidesHtml(slides, slideTemplate) {
        return slides.map((slide) => fillTemplate(slideTemplate, slide)).join('');
    }

    function buildSliderHtml(sliderId, slides, sliderTemplate, slideTemplate, itemsKey = 'slides') {
        const slidesHtml = buildSlidesHtml(slides, slideTemplate);
        return fillTemplate(sliderTemplate, { id: sliderId, [itemsKey]: slidesHtml });
    }

    function buildProductionHtml(htmlTemplates, sliderData, pageConfig) {
        const sliderContainer = document.getElementById(sliderContainerId);

        if (!sliderContainer) {
            console.warn(`(Slider Framework) Expected container "#${sliderContainerId}" not found. Skipping placeholder injection.`);
            return;
        }

        const productionHtml = pageConfig.sliders.map((slider) => {
            const sliderId = slider.id;
            const slides = sliderData[sliderId];

            if (!Array.isArray(slides)) {
                console.warn(`(Slider Framework) No slider data found for: #${sliderId}`);
                return '';
            }

            const isMarquee = slider.sliderLibrary === 'Marquee6k';
            const rowTemplate = htmlTemplates.rows[slider.rowLayout];
            const sliderTemplate = isMarquee
                ? htmlTemplates.marquees[slider.sliderLayout]
                : htmlTemplates.sliders[slider.sliderLayout];
            const slideTemplate = htmlTemplates.slides[slider.slideLayout];

            if (!rowTemplate || !sliderTemplate || !slideTemplate) {
                console.warn(`(Slider Framework) Missing HTML template(s) for slider: #${sliderId}`);
                return '';
            }

            const itemsKey = isMarquee ? 'items' : 'slides';
            const sliderHtml = buildSliderHtml(sliderId, slides, sliderTemplate, slideTemplate, itemsKey);
            return fillTemplate(rowTemplate, { slider: sliderHtml });
        }).join('');

        sliderContainer.innerHTML = productionHtml;
    }

    /* ==================================
        Add Swiper Files
    ================================== */
    function addStyles(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${url}"]`)) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;

            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`(Slider Framework) Failed to load stylesheet at: ${url}`));

            document.head.prepend(link);
        });
    }

    function addScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            script.defer = true;

            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`(Slider Framework) Failed to load script at: ${url}`));

            document.head.prepend(script);
        });
    }

    async function addSwiperAssets() {
        const cssUrl = 'https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.css';
        const jsUrl = 'https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js';

        await Promise.all([
            addStyles(cssUrl),
            addScript(jsUrl)
        ]);
    }

    async function addMarqueeAssets() {
        const jsUrl = 'https://cdn.jsdelivr.net/npm/marquee6k@1.3.4/marquee6k.min.js';

        await Promise.all([
            addScript(jsUrl)
        ]);
    }

    /* ==================================
        Initiate Swiper
    ================================== */
    function initSwiper(pageConfig) {
        if (typeof Swiper === 'undefined') {
            console.warn(`(Slider Framework) Swiper is not available on the window.`);
            return;
        }

        const swiperElements = document.querySelectorAll('.swiper');

        if (!swiperElements.length) {
            console.warn(`(SliderFramework) No ".swiper" elements found in the DOM.`);
            return;
        }

        swiperElements.forEach((element) => {
            const swiperContainer = element.closest('.swiper-container');
            const sliderId = swiperContainer?.id;

            if (!sliderId) {
                console.warn(`(Slider Framework) Missing slider ID on ".swiper-container":`, element);
                return;
            }

            const sliderConfig = pageConfig.sliders.find((slider) => slider.id === sliderId);

            if (!sliderConfig) {
                console.warn(`(Slider Framework) No page config found for slider: #${sliderId}`);
                return;
            }

            const prevButton = swiperContainer.querySelector('.swiper-button-prev');
            const nextButton = swiperContainer.querySelector('.swiper-button-next');
            const toggleButton = swiperContainer.querySelector('.swiper-button-toggle');

            const swiperOptions = getSwiperOptions(sliderConfig, { prevButton, nextButton });
            const slider = new Swiper(element, swiperOptions);

            if (toggleButton && slider.autoplay) {
                function stopAutoplay() {
                    slider.autoplay.stop();
                    toggleButton.classList.remove('active');
                    toggleButton.classList.add('inactive');
                    toggleButton.setAttribute('aria-label', 'Start slider');
                }

                function startAutoplay() {
                    slider.autoplay.start();
                    toggleButton.classList.remove('inactive');
                    toggleButton.classList.add('active');
                    toggleButton.setAttribute('aria-label', 'Stop slider');
                }

                function toggleAutoplay() {
                    if (slider.autoplay.running) {
                        stopAutoplay();
                    } else {
                        startAutoplay();
                    }
                }

                toggleButton.addEventListener('click', toggleAutoplay);

                toggleButton.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    toggleAutoplay();
                });
            }
        });
    }

    /* ==================================
        Initiate Marquee6k
    ================================== */
    function initMarquee(pageConfig) {
        if (typeof marquee6k === 'undefined') {
            console.warn(`(Slider Framework) Marquee6k is not available on the window.`);
            return;
        }

        const marqueeElements = document.querySelectorAll('.marquee6k');

        if (!marqueeElements.length) {
            console.warn(`(Slider Framework) No ".marquee6k" elements found in the DOM.`);
            return;
        }

        marqueeElements.forEach((element) => {
            const sliderId = element.id;

            if (!sliderId) {
                console.warn(`(Slider Framework) Missing ID on ".marquee6k" element:`, element);
                return;
            }

            const sliderConfig = pageConfig.sliders.find((slider) => slider.id === sliderId);

            if (!sliderConfig) {
                console.warn(`(Slider Framework) No page config found for marquee: #${sliderId}`);
                return;
            }

            const marqueeOptions = sliderConfig.marqueeOptions || {};
            new marquee6k(element, marqueeOptions);
        });
    }

    /* ==================================
        Helper Functions
    ================================== */
    const TEMPLATE_REGEX = /\{\{(.*?)\}\}/g;

    function fillTemplate(template, data) {
        return template.replace(TEMPLATE_REGEX, fillPlaceholder);

        function fillPlaceholder(match, key) {
            const label = key.trim();
            const value = data[label];

            if (value == null) {
                console.log(`(Slider Framework) Missing key "${label}" in template:`, data);
                return '';
            }

            return String(value);
        }
    }

    function getSwiperOptions(sliderConfig, sliderElements) {
        const extraOpts = sliderConfig.swiperOptions || {};
        const baseMode = resolveMode(sliderConfig.sliderMode || 'single');

        return {
            ...DEFAULT_SWIPER_OPTIONS,
            ...baseMode,
            ...extraOpts,

            navigation: sliderElements.prevButton && sliderElements.nextButton ? {
                prevEl: sliderElements.prevButton,
                nextEl: sliderElements.nextButton,
                addIcons: false
            } : false,

            autoplay: resolveAutoplay(extraOpts.autoplay),
            breakpoints: resolveBreakpoints(sliderConfig.breakpoints)
        };
    }

    function resolveBreakpoints(breakpoints) {
        if (!breakpoints) return undefined;

        const resolved = {};

        for (const [width, config] of Object.entries(breakpoints)) {
            resolved[width] = {
                ...resolveMode(config.sliderMode),
                ...config.swiperOptions
            };
        }

        return resolved;
    }

    function resolveAutoplay(autoplay) {
        const DEFAULT_AUTOPLAY_OPTIONS = {
            delay: 500,
            pauseOnMouseEnter: true
        };

        if (!autoplay) return false;
        if (autoplay === true) return { ...DEFAULT_AUTOPLAY_OPTIONS };
        if (typeof autoplay === 'object') return { ...DEFAULT_AUTOPLAY_OPTIONS, ...autoplay };

        return false;
    }

    function resolveMode(mode) {
        return SLIDER_MODE_OPTIONS[mode] || SLIDER_MODE_OPTIONS.single;
    }

})();
