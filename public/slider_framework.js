(() => {
    /* ===============================
        Path (URL) Handler
    =============================== */
    const pageName = getPageName(window.location.pathname);
    const pageList = ['movies', 'shows'];

    if (!pageList.includes(pageName)) {
        console.log(`(Debug) Skipping page: ${pageName}`);
        return;
    };

    buildPlaceholderHtml(pageName);
    init(pageName);

    function getPageName(path) {
        let pageName = path.replace(/^\/+/, '');

        if (pageName === '') {
            return 'home';
        };

        pageName = pageName.replace(/\.html$/, '');

        return pageName;
    };

    /* ===============================
        Build Slider (Placeholder)
    =============================== */
    function createPlaceholderSlide() {
        return `
            <div class="swiper-placeholder-slide">
                <p>Loading...</p>
            </div>
        `;
    };

    function generateSlides(count) {
        return Array.from({ length: count }, createPlaceholderSlide).join('');
    };

    function createPlaceholderSlider(slidesHtml) {
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

    function buildPlaceholderHtml(page) {
        const sliderContainer = document.getElementById('sliders');

        if (!sliderContainer) {
            throw new Error(`(Slider Framework) Missing container element in the DOM: #sliders`);
        };

        const placeholderCounts = {
            movies: 3,
            shows: 2
        };

        const sliderCount = placeholderCounts[page] || 1;
        const slidesPerSlider = 5;

        const placeholderHtml = Array.from({ length: sliderCount }, () => {
            const slidesHtml = generateSlides(slidesPerSlider);
            return createPlaceholderSlider(slidesHtml);
        }).join('');

        sliderContainer.innerHTML = placeholderHtml;
    };

    /* ===============================
        Fetch HTML Templates (JSON)
    =============================== */
    async function fetchTemplates() {
        const templatePath = '/config/templates.json';
        const response = await fetch(templatePath);

        if (!response.ok) {
            throw new Error(`(Slider Framework) Failed to fetch template (${response.status}): ${response.url}`);
        };

        return response.json();
    };

    /* ===============================
        Fetch Page Config (JSON)
    =============================== */
    async function fetchConfig(page) {
        const configPath = `/config/${page}.config.json`;
        const response = await fetch(configPath);

        if (!response.ok) {
            throw new Error(`(Slider Framework) Failed to fetch config (${response.status}): ${response.url}`);
        };

        return response.json();
    };

    /* ===============================
        Build Slider (Production)
    =============================== */
    async function init(page) {
        try {
            const htmlTemplates = await fetchTemplates();
            const sliderData = await fetchSliders();
            const pageConfig = await fetchConfig(page);

            injectProductionHtml(htmlTemplates, sliderData, pageConfig);
        } catch (error) {
            console.error(`(Slider Framework) Failed to fetch config file(s):`, error);
        };
    };

    function buildSlidesHtml(items, slideTemplate) {
        return items.map(item => fillTemplate(slideTemplate, item)).join('');
    }

    function buildSliderHtml(sliderId, items, sliderTemplate, slideTemplate) {
        const slidesHtml = buildSlidesHtml(items, slideTemplate);

        return fillTemplate(sliderTemplate, {
            id: sliderId,
            slides: slidesHtml
        });
    }

    function buildRowHtml(sliderHtml, rowTemplate) {
        return fillTemplate(rowTemplate, {
            slider: sliderHtml
        });
    }

    function injectProductionHtml(htmlTemplates, sliderData, pageConfig) {
        const sliderContainer = document.getElementById('sliders');

        if (!sliderContainer) {
            throw new Error(`(Slider Framework) Missing #sliders element in the DOM.`);
        };

        const productionHtml = pageConfig.sliders.map((sliderConfig) => {
            const sliderId = sliderConfig.id;
            const slides = sliderData[sliderId];

            if (!Array.isArray(slides)) {
                throw new Error(`(Slider Framework) No slider data found for: ${sliderId}`);
            };

            const rowTemplate = htmlTemplates.rows[sliderConfig.rowLayout];
            const sliderTemplate = htmlTemplates.sliders[sliderConfig.sliderLayout];
            const slideTemplate = htmlTemplates.slides[sliderConfig.slideLayout];

            if (!rowTemplate || !sliderTemplate || !slideTemplate) {
                throw new Error(`(Slider Framework) Missing HTML template(s) for slider "${sliderId}":
                        rowLayout: ${sliderConfig.rowLayout}
                        sliderLayout: ${sliderConfig.sliderLayout}
                        slideLayout: ${sliderConfig.slideLayout}
                    `);
            };

            const sliderHtml = buildSliderHtml(
                sliderId,
                slides,
                sliderTemplate,
                slideTemplate
            );

            return buildRowHtml(sliderHtml, rowTemplate);
        }).join('');

        sliderContainer.innerHTML = productionHtml;
    };

    /* ===============================
        Fetch Slider Data (JSON)
    =============================== */
    async function fetchSliders() {
        const dataPath = '/data/sliders.json';
        const response = await fetch(dataPath);

        if (!response.ok) {
            throw new Error(`(Slider Framework) Failed to fetch slider data (${response.status}): ${response.url}`);
        };

        return response.json();
    };

    /* ===============================
        Replace Template Placeholders
    =============================== */
    function fillTemplate(template, data) {
        return template.replace(/\{\{(.*?)\}\}/g, (match, key) => { // MATCH: "{{title}}"", KEY: "title"
            const trimmedKey = key.trim(); // EXAMPLE: "{{ title }} → " title " → "title"
            const value = data[trimmedKey]; // EXAMPLE: data["title"] → "Mad Max"

            if (value == null) {
                console.warn(`(Slider Framework) Missing key "${trimmedKey}" in template`, data);
                return ''; // NOTE: Slider will be visually broken, but the website won't crash.
            };

            return String(value); // EXAMPLE: {{title}} → "Mad Max"
        });
    };

    /* ===============================
        Inject Swiper
    =============================== */

})();