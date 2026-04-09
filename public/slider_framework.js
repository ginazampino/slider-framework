(() => {

    /* ============================================================
        Constants
    ============================================================ */

    const WHITELISTED_PAGES = new Set(['movies', 'shows']);
    const SLIDER_CONTAINER_ID = 'sliders';
    const PLACEHOLDER_COUNTS = { movies: 3, shows: 2 };
    const PLACEHOLDER_SLIDE_COUNT = 5;

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

    const DEFAULT_AUTOPLAY_OPTIONS = {
        delay: 500,
        pauseOnMouseEnter: true
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


    /* ============================================================
        Startup
    ============================================================ */

    const pageName = getPageName(window.location.pathname);

    if (!WHITELISTED_PAGES.has(pageName)) return;

    buildPlaceholderHtml(pageName);
    init(pageName);


    /* ============================================================
        Page Name
    ============================================================ */

    function getPageName(path) {
        const name = path
            .replace(/^\/+/, '')
            .replace(/\.(html|aspx)$/, '');

        return name || '';
    }


    /* ============================================================
        Placeholder HTML
    ============================================================ */

    function buildPlaceholderHtml(page) {
        const container = document.getElementById(SLIDER_CONTAINER_ID);

        if (!container) {
            console.warn(`(Slider Framework) Container "#${SLIDER_CONTAINER_ID}" not found on page "${page}".`);
            return;
        }

        const count = PLACEHOLDER_COUNTS[page] || 1;
        const sliders = Array.from({ length: count }, buildPlaceholderSlider);

        container.innerHTML = sliders.join('');
    }

    function buildPlaceholderSlider() {
        const slides = Array.from({ length: PLACEHOLDER_SLIDE_COUNT }, () =>
            `<div class="swiper-placeholder-slide"><p>Loading...</p></div>`
        ).join('');

        return `
            <div class="band">
                <div class="swiper">
                    <div class="swiper-placeholder-wrapper">
                        ${slides}
                    </div>
                </div>
            </div>
        `;
    }


    /* ============================================================
        Data Fetching
    ============================================================ */

    async function fetchJson(path) {
        const response = await fetch(path);

        if (!response.ok) {
            throw new Error(`(Slider Framework) Failed to fetch (${response.status}): ${response.url}`);
        }

        return response.json();
    }

    async function fetchSliderConfigs(sliderIds) {
        try {
            const allConfigs = await fetchJson('/sliders/sliders.config.json');

            return sliderIds.map((sliderId) => {
                const config = allConfigs[sliderId];

                if (!config) {
                    console.warn(`(Slider Framework) No config found for slider "${sliderId}".`);
                    return null;
                }

                return config;
            }).filter(Boolean);
        } catch (error) {
            console.error('(Slider Framework) Failed to load slider configs.', error);
            return [];
        }
    }


    /* ============================================================
        Segment Logic
    ============================================================ */

    function getUserSegment(appConfig) {
        if (!appConfig) return 'loggedOut';
        if (appConfig.userSegment) return appConfig.userSegment;
        if (appConfig.isLoggedIn) return 'loggedIn';
        return 'loggedOut';
    }

    function resolveSegmentSliders(segmentConfig, context) {
        if (!segmentConfig || !Array.isArray(segmentConfig.segments)) {
            console.warn('(Slider Framework) Invalid segment config.');
            return [];
        }

        const match = segmentConfig.segments.find((segment) =>
            Object.entries(segment.when || {}).every(([key, value]) => context[key] === value)
        );

        if (!match) {
            console.warn('(Slider Framework) No matching segment found for context:', context);
            return [];
        }

        return Array.isArray(match.sliders) ? match.sliders : [];
    }


    /* ============================================================
        Initialize
    ============================================================ */

    async function init(page) {
        await simulateLoading(2000);

        try {
            const [sliderData, segmentConfig, templates] = await Promise.all([
                fetchJson('/data/sliders.json'),
                fetchJson(`/segments/${page}.segments.json`),
                fetchJson('/templates/slider.templates.json')
            ]);

            const context = { userType: getUserSegment(window.appConfig) };
            const sliderIds = resolveSegmentSliders(segmentConfig, context);
            const sliderConfigs = await fetchSliderConfigs(sliderIds);

            if (!sliderConfigs.length) {
                console.warn(`(Slider Framework) No sliders resolved for page "${page}".`);
                const container = document.getElementById(SLIDER_CONTAINER_ID);
                if (container) container.innerHTML = '';
                return;
            }

            buildProductionHtml(templates, sliderData, sliderConfigs);

            const needsSwiper = sliderConfigs.some((c) => c.sliderLibrary !== 'Marquee6k');
            const needsMarquee = sliderConfigs.some((c) => c.sliderLibrary === 'Marquee6k');

            const assetLoaders = [];
            if (needsSwiper) assetLoaders.push(loadSwiperAssets());
            if (needsMarquee) assetLoaders.push(loadMarqueeAssets());
            await Promise.all(assetLoaders);

            if (needsSwiper) initSwiper(sliderConfigs);
            if (needsMarquee) initMarquee(sliderConfigs);
        } catch (error) {
            console.error('(Slider Framework) Failed to initialize:', error);
        }
    }


    /* ============================================================
        Build Production HTML
    ============================================================ */

    function buildProductionHtml(templates, sliderData, sliderConfigs) {
        const container = document.getElementById(SLIDER_CONTAINER_ID);

        if (!container) {
            console.warn(`(Slider Framework) Container "#${SLIDER_CONTAINER_ID}" not found.`);
            return;
        }

        const html = sliderConfigs.map((config) => {
            const slides = sliderData[config.id];

            if (!Array.isArray(slides)) {
                console.warn(`(Slider Framework) No data found for slider: #${config.id}`);
                return '';
            }

            const isMarquee = config.sliderLibrary === 'Marquee6k';
            const rowTemplate = templates.rows[config.rowLayout];
            const sliderTemplate = isMarquee
                ? templates.marquees[config.sliderLayout]
                : templates.sliders[config.sliderLayout];
            const slideTemplate = templates.slides[config.slideLayout];

            if (!rowTemplate || !sliderTemplate || !slideTemplate) {
                console.warn(`(Slider Framework) Missing template(s) for slider: #${config.id}`);
                return '';
            }

            const itemsKey = isMarquee ? 'items' : 'slides';
            const slidesHtml = slides.map((slide) => fillTemplate(slideTemplate, slide)).join('');
            const sliderHtml = fillTemplate(sliderTemplate, { ...config, [itemsKey]: slidesHtml });

            return fillTemplate(rowTemplate, { slider: sliderHtml });
        }).join('');

        container.innerHTML = html;
    }


    /* ============================================================
        Initialize Swiper
    ============================================================ */

    function initSwiper(sliderConfigs) {
        if (typeof Swiper === 'undefined') {
            console.warn('(Slider Framework) Swiper is not available.');
            return;
        }

        const swiperElements = document.querySelectorAll('.swiper');

        if (!swiperElements.length) {
            console.warn('(Slider Framework) No ".swiper" elements found.');
            return;
        }

        swiperElements.forEach((element) => {
            const swiperContainer = element.closest('.swiper-container');
            const sliderId = swiperContainer && swiperContainer.id;

            if (!sliderId) {
                console.warn('(Slider Framework) Missing ID on ".swiper-container":', element);
                return;
            }

            const config = sliderConfigs.find((c) => c.id === sliderId);

            if (!config) {
                console.warn(`(Slider Framework) No config found for slider: #${sliderId}`);
                return;
            }

            const prevButton = swiperContainer.querySelector('.swiper-button-prev');
            const nextButton = swiperContainer.querySelector('.swiper-button-next');
            const toggleButton = swiperContainer.querySelector('.swiper-button-toggle');

            const instance = new Swiper(element, getSwiperOptions(config, { prevButton, nextButton }));

            if (toggleButton && instance.autoplay) {
                bindAutoplayToggle(instance, toggleButton);
            }
        });
    }

    function bindAutoplayToggle(instance, toggleButton) {
        function stop() {
            instance.autoplay.stop();
            toggleButton.classList.remove('active');
            toggleButton.classList.add('inactive');
            toggleButton.setAttribute('aria-label', 'Start slider');
        }

        function start() {
            instance.autoplay.start();
            toggleButton.classList.remove('inactive');
            toggleButton.classList.add('active');
            toggleButton.setAttribute('aria-label', 'Stop slider');
        }

        function toggle() {
            instance.autoplay.running ? stop() : start();
        }

        toggleButton.addEventListener('click', toggle);

        toggleButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });
    }


    /* ============================================================
        Initialize Marquee
    ============================================================ */

    function initMarquee(sliderConfigs) {
        if (typeof marquee6k === 'undefined') {
            console.warn('(Slider Framework) Marquee6k is not available.');
            return;
        }

        const marqueeElements = document.querySelectorAll('.marquee6k');

        if (!marqueeElements.length) {
            console.warn('(Slider Framework) No ".marquee6k" elements found.');
            return;
        }

        marqueeElements.forEach((element) => {
            if (!element.id) {
                console.warn('(Slider Framework) Missing ID on ".marquee6k" element:', element);
                return;
            }

            const config = sliderConfigs.find((c) => c.id === element.id);

            if (!config) {
                console.warn(`(Slider Framework) No config found for marquee: #${element.id}`);
                return;
            }

            new marquee6k(element, config.marqueeOptions || {});
        });
    }


    /* ============================================================
        Load Assets
    ============================================================ */

    async function loadSwiperAssets() {
        await Promise.all([
            loadStyle('https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.css'),
            loadScript('https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js')
        ]);
    }

    async function loadMarqueeAssets() {
        await loadScript('https://cdn.jsdelivr.net/npm/marquee6k@1.3.4/marquee6k.min.js');
    }

    function loadStyle(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${url}"]`)) return resolve();

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = resolve;
            link.onerror = () => reject(new Error(`(Slider Framework) Failed to load stylesheet: ${url}`));

            document.head.prepend(link);
        });
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();

            const script = document.createElement('script');
            script.src = url;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`(Slider Framework) Failed to load script: ${url}`));

            document.head.prepend(script);
        });
    }


    /* ============================================================
        Swiper Options
    ============================================================ */

    function getSwiperOptions(config, { prevButton, nextButton }) {
        const extra = config.swiperOptions || {};
        const mode = resolveMode(config.sliderMode || 'single');

        return {
            ...DEFAULT_SWIPER_OPTIONS,
            ...mode,
            ...extra,
            navigation: prevButton && nextButton
                ? { prevEl: prevButton, nextEl: nextButton, addIcons: false }
                : false,
            autoplay: resolveAutoplay(extra.autoplay),
            breakpoints: resolveBreakpoints(config.breakpoints)
        };
    }

    function resolveMode(mode) {
        return SLIDER_MODE_OPTIONS[mode] || SLIDER_MODE_OPTIONS.single;
    }

    function resolveAutoplay(autoplay) {
        if (!autoplay) return false;
        if (autoplay === true) return { ...DEFAULT_AUTOPLAY_OPTIONS };
        if (typeof autoplay === 'object') return { ...DEFAULT_AUTOPLAY_OPTIONS, ...autoplay };
        return false;
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


    /* ============================================================
        Template Utilities
    ============================================================ */

    const TEMPLATE_REGEX = /\{\{(.*?)\}\}/g;

    function fillTemplate(template, data) {
        return template.replace(TEMPLATE_REGEX, (_, key) => {
            const label = key.trim();
            const value = data[label];

            if (value == null) {
                console.log(`(Slider Framework) Missing key "${label}" in template:`, data);
                return '';
            }

            return String(value);
        });
    }


    /* ============================================================
        Development Helpers
    ============================================================ */

    function simulateLoading(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

})();
