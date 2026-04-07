(() => {
    if (window.appConfig && window.appConfig.isLoggedIn) {
        console.log('the user is logged in');
        console.log('user segment:', window.appConfig.userSegment);
    }

    function simulateLoading(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    /* ==================================
        Filter Allowed Pages
    ================================== */
    const ALLOWED_PAGES = new Set(['movies', 'shows']);
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
            placeholderSliders.push(
                generatePlaceholderSlider(
                    generatePlaceholderSlides(placeholderSlideAmount)
                )
            );
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
            throw new Error(`(Slider Framework) Failed to fetch (${response.status}): ${response.url}`);
        }

        return response.json();
    }

    /* ==================================
        Segment Logic
    ================================== */
    function getUserSegment(appConfig) {
        if (!appConfig) return 'loggedOut';
        if (appConfig.userSegment) return appConfig.userSegment;
        if (appConfig.isLoggedIn) return 'loggedIn';
        return 'loggedOut';
    }

    function matchesWhen(when, context) {
        return Object.entries(when).every(([key, value]) => context[key] === value);
    }

    function resolveSegmentSliders(segmentConfig, context) {
        if (!segmentConfig || !Array.isArray(segmentConfig.segments)) {
            console.warn('(Slider Framework) Invalid segment config.');
            return [];
        }

        const matchedSegment = segmentConfig.segments.find((segment) =>
            matchesWhen(segment.when || {}, context)
        );

        if (!matchedSegment) {
            console.warn('(Slider Framework) No matching segment found for context:', context);
            return [];
        }

        return Array.isArray(matchedSegment.sliders) ? matchedSegment.sliders : [];
    }

    async function fetchSliderConfigs(sliderIds) {
        const results = await Promise.all(
            sliderIds.map(async (sliderId) => {
                try {
                    return await fetchJson(`/sliders/${sliderId}.config.json`);
                } catch (error) {
                    console.warn(`(Slider Framework) Failed to load slider config for "${sliderId}".`, error);
                    return null;
                }
            })
        );

        return results.filter(Boolean);
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
            const [sliderData, segmentConfig] = await Promise.all([
                fetchJson('/data/sliders.json'),
                fetchJson(`/segments/${page}.segments.json`)
            ]);

            const htmlTemplates = window.SliderTemplates;

            if (!htmlTemplates) {
                console.error('(Slider Framework) window.SliderTemplates is not available.');
                return;
            }

            const context = {
                userType: getUserSegment(window.appConfig)
            };

            const sliderIds = resolveSegmentSliders(segmentConfig, context);
            const sliderConfigs = await fetchSliderConfigs(sliderIds);

            if (!sliderConfigs.length) {
                console.warn(`(Slider Framework) No slider configs resolved for page "${page}".`);

                const sliderContainer = document.getElementById(sliderContainerId);
                if (sliderContainer) {
                    sliderContainer.innerHTML = '';
                }

                return;
            }

            buildProductionHtml(htmlTemplates, sliderData, sliderConfigs);

            const needsSwiper = sliderConfigs.some((slider) => slider.sliderLibrary !== 'Marquee6k');
            const needsMarquee = sliderConfigs.some((slider) => slider.sliderLibrary === 'Marquee6k');

            const assetPromises = [];

            if (needsSwiper) assetPromises.push(addSwiperAssets());
            if (needsMarquee) assetPromises.push(addMarqueeAssets());

            await Promise.all(assetPromises);

            if (needsSwiper) initSwiper(sliderConfigs);
            if (needsMarquee) initMarquee(sliderConfigs);
        } catch (error) {
            console.error('(Slider Framework) Failed to initialize sliders:', error);
        }
    }

    /* ==================================
        Build Production Sliders
    ================================== */
    function buildSlidesHtml(slides, slideTemplate) {
        return slides.map((slide) => fillTemplate(slideTemplate, slide)).join('');
    }

    function buildSliderHtml(sliderConfig, slides, sliderTemplate, slideTemplate, itemsKey = 'slides') {
        const slidesHtml = buildSlidesHtml(slides, slideTemplate);

        return fillTemplate(sliderTemplate, {
            ...sliderConfig,
            [itemsKey]: slidesHtml
        });
    }

    function buildProductionHtml(htmlTemplates, sliderData, sliderConfigs) {
        const sliderContainer = document.getElementById(sliderContainerId);

        if (!sliderContainer) {
            console.warn(`(Slider Framework) Expected container "#${sliderContainerId}" not found. Skipping placeholder injection.`);
            return;
        }

        const productionHtml = sliderConfigs.map((sliderConfig) => {
            const sliderId = sliderConfig.id;
            const slides = sliderData[sliderId];

            if (!Array.isArray(slides)) {
                console.warn(`(Slider Framework) No slider data found for: #${sliderId}`);
                return '';
            }

            const isMarquee = sliderConfig.sliderLibrary === 'Marquee6k';
            const rowTemplate = htmlTemplates.rows[sliderConfig.rowLayout];
            const sliderTemplate = isMarquee
                ? htmlTemplates.marquees[sliderConfig.sliderLayout]
                : htmlTemplates.sliders[sliderConfig.sliderLayout];
            const slideTemplate = htmlTemplates.slides[sliderConfig.slideLayout];

            if (!rowTemplate || !sliderTemplate || !slideTemplate) {
                console.warn(`(Slider Framework) Missing HTML template(s) for slider: #${sliderId}`);
                return '';
            }

            const itemsKey = isMarquee ? 'items' : 'slides';
            const sliderHtml = buildSliderHtml(
                sliderConfig,
                slides,
                sliderTemplate,
                slideTemplate,
                itemsKey
            );

            return fillTemplate(rowTemplate, {
                slider: sliderHtml
            });
        }).join('');

        sliderContainer.innerHTML = productionHtml;
    }

    /* ==================================
        Add Asset Files
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
    function initSwiper(sliderConfigs) {
        if (typeof Swiper === 'undefined') {
            console.warn('(Slider Framework) Swiper is not available on the window.');
            return;
        }

        const swiperElements = document.querySelectorAll('.swiper');

        if (!swiperElements.length) {
            console.warn('(Slider Framework) No ".swiper" elements found in the DOM.');
            return;
        }

        swiperElements.forEach((element) => {
            const swiperContainer = element.closest('.swiper-container');
            const sliderId = swiperContainer && swiperContainer.id;

            if (!sliderId) {
                console.warn('(Slider Framework) Missing slider ID on ".swiper-container":', element);
                return;
            }

            const sliderConfig = sliderConfigs.find((slider) => slider.id === sliderId);

            if (!sliderConfig) {
                console.warn(`(Slider Framework) No slider config found for slider: #${sliderId}`);
                return;
            }

            const prevButton = swiperContainer.querySelector('.swiper-button-prev');
            const nextButton = swiperContainer.querySelector('.swiper-button-next');
            const toggleButton = swiperContainer.querySelector('.swiper-button-toggle');

            const swiperOptions = getSwiperOptions(sliderConfig, {
                prevButton,
                nextButton
            });

            const sliderInstance = new Swiper(element, swiperOptions);

            if (toggleButton && sliderInstance.autoplay) {
                function stopAutoplay() {
                    sliderInstance.autoplay.stop();
                    toggleButton.classList.remove('active');
                    toggleButton.classList.add('inactive');
                    toggleButton.setAttribute('aria-label', 'Start slider');
                }

                function startAutoplay() {
                    sliderInstance.autoplay.start();
                    toggleButton.classList.remove('inactive');
                    toggleButton.classList.add('active');
                    toggleButton.setAttribute('aria-label', 'Stop slider');
                }

                function toggleAutoplay() {
                    if (sliderInstance.autoplay.running) {
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
    function initMarquee(sliderConfigs) {
        if (typeof marquee6k === 'undefined') {
            console.warn('(Slider Framework) Marquee6k is not available on the window.');
            return;
        }

        const marqueeElements = document.querySelectorAll('.marquee6k');

        if (!marqueeElements.length) {
            console.warn('(Slider Framework) No ".marquee6k" elements found in the DOM.');
            return;
        }

        marqueeElements.forEach((element) => {
            const sliderId = element.id;

            if (!sliderId) {
                console.warn('(Slider Framework) Missing ID on ".marquee6k" element:', element);
                return;
            }

            const sliderConfig = sliderConfigs.find((slider) => slider.id === sliderId);

            if (!sliderConfig) {
                console.warn(`(Slider Framework) No slider config found for marquee: #${sliderId}`);
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

            navigation: sliderElements.prevButton && sliderElements.nextButton
                ? {
                    prevEl: sliderElements.prevButton,
                    nextEl: sliderElements.nextButton,
                    addIcons: false
                }
                : false,

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