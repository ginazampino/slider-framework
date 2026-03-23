(() => {
    /* ==================================
        Filter Allowed Pages
    ================================== */
    const ALLOWED_PAGES = new Set(['movies', 'shows']); // NOTE: Faster than Array
    const pageName = getPageName(window.location.pathname);

    if (!ALLOWED_PAGES.has(pageName)) {
        console.log(`⚠️ (Debug - Slider Framework) Page "${pageName}" is not allowed. Skipping page.`);
        return;
    };
    
    function getPageName(path) {
        const extractedName = path
            .replace(/^\/+/, '')
            .replace(/\.(html|aspx)$/, '');
        return extractedName || '';
    };

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
        };

        const placeholderSliderAmount = placeholderAmounts[page] || 1;
        const placeholderSliders = [];

        for (let i = 0; i < placeholderSliderAmount; i++) {
            const slidesHtml = generatePlaceholderSlides(placeholderSlideAmount);
            const sliderHtml = generatePlaceholderSlider(slidesHtml);

            placeholderSliders.push(sliderHtml);
        };

        const placeholderHtml = placeholderSliders.join('');
        sliderContainer.innerHTML = placeholderHtml;
    };

    function generatePlaceholderSlides(amount) {
        const slides = [];

        for (let i = 0; i < amount; i++) {
            slides.push(`
                <div class="swiper-placeholder-slide">
                    <p>Loading...</p>
                </div>
            `);
        };

        return slides.join('');
    };

    function generatePlaceholderSlider(slidesHtml) {
        return `
            <div class="band">
                <h2>Slider Mode: Placeholder</h2>
                <div class="swiper">
                    <div class="swiper-placeholder-wrapper">
                        ${slidesHtml}
                    </div>
                </div>
            </div>
        `;
    };

    /* ==================================
        Fetch JSON Files
    ================================== */
    async function fetchHtmlTemplates() {
        const path = '/config/templates.json';
        const response = await fetch(path);

        if (!response.ok) {
            console.log(`(Slider Framework) Failed to fetch HTML templates (${response.status}): ${response.url}`);
            return;
        };

        return response.json();
    };

    async function fetchSliderData() {
        const path = '/data/sliders.json';
        const response = await fetch(path);

        if (!response.ok) {
            console.log(`(Slider Framework) Failed to fetch slider data (${response.status}): ${response.url}`);
            return;
        };
        
        return response.json();
    };

    async function fetchPageConfig(page) {
        const path = `/config/${page}.config.json`;
        const response = await fetch(path);

        if (!response.ok) {
            console.log(`(Slider Framework) Failed to fetch page config (${response.status}): ${response.url}`);
            return;
        };

        return response.json();
    };

    /* ==================================
        Initiate Production Page
    ================================== */
    async function init(page) {
        try {
            const htmlTemplates = await fetchHtmlTemplates();
            const sliderData = await fetchSliderData();
            const pageConfig = await fetchPageConfig(page);

            buildProductionHtml(htmlTemplates, sliderData, pageConfig);
            await addSwiperAssets();
        } catch (error) {
            console.error(`(Slider Framework) Failed to fetch required config file(s) from server:`, error);
        };
    };

    /* ==================================
        Build Production Sliders
    ================================== */
    function buildSlidesHtml(slides, slideTemplate) {
        const slideHtmlList = [];
        
        for (const slide of slides) {
            const slideHtml = fillTemplate(slideTemplate, slide);
            slideHtmlList.push(slideHtml);
        };

        return slideHtmlList.join('');
    };

    function buildSliderHtml(sliderId, slides, sliderTemplate, slideTemplate) {
        const slidesHtml = buildSlidesHtml(slides, slideTemplate);

        const templateData = {
            id: sliderId,
            slides: slidesHtml
        };

        return fillTemplate(sliderTemplate, templateData);
    };

    function buildRowHtml(sliderHtml, rowTemplate) {
        const templateData = {
            slider: sliderHtml
        };

        return fillTemplate(rowTemplate, templateData);
    };

    function buildProductionHtml(htmlTemplates, sliderData, pageConfig) {
        const sliderContainer = document.getElementById(sliderContainerId);
        
        if (!sliderContainer) {
            console.warn(`(Slider Framework) Expected container "#${sliderContainerId}" not found. Skipping placeholder injection.`);
            return;
        };

        const productionHtml = pageConfig.sliders.map((slider) => {
            const sliderId = slider.id;
            const slides = sliderData[sliderId];

            if (!Array.isArray(slides)) {
                console.warn(`(Slider Framework) No slider data found for: #${sliderId}`);
                return;
            };

            const rowTemplate = htmlTemplates.rows[slider.rowLayout];
            const sliderTemplate = htmlTemplates.sliders[slider.sliderLayout];
            const slideTemplate = htmlTemplates.slides[slider.slideLayout];

            if (!rowTemplate || !sliderTemplate || !slideTemplate) {
                console.warn(`(Slider Framework) Missing HTML template(s) for slider: #${sliderId}`);
                return;
            };

            const sliderHtml = buildSliderHtml(sliderId, slides, sliderTemplate, slideTemplate);

            return buildRowHtml(sliderHtml, rowTemplate);
        }).join('');

        sliderContainer.innerHTML = productionHtml;
    };

    /* ==================================
        Add Swiper Files
    ================================== */
    function addSwiperStyles(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${url}"]`)) {
                resolve();
                return;
            };

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`(Slider Framework) Failed to load Swiper stylesheet at: ${url}`));
        
            document.head.prepend(link);
        });
    };

    function addSwiperScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}]`)) {
                resolve();
                return;
            };

            const script = document.createElement('script');
            script.src = url;
            script.defer = true;

            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`(Slider Framework) Failed to load Swiper script at: ${url}`));

            document.head.prepend(script);
        });
    };

    async function addSwiperAssets() {
        const cssUrl = 'https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.css';
        const jsUrl = 'https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js';

        await addSwiperStyles(cssUrl);
        await addSwiperScript(jsUrl);
    };

    /* ==================================
        Helper Function(s)
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
            };

            return String(value);
        };
    };
})();