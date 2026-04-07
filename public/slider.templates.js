window.SliderTemplates = {
    rows: {
        default: `
            <div class="band">
                {{slider}}
            </div>
        `
    },

    sliders: {
        default: `
            <div id="{{id}}" class="swiper-container">
                <h2>{{title}}</h2>
                <div class="swiper">
                    <div class="swiper-wrapper">
                        {{slides}}
                    </div>
                    <div class="swiper-button-prev"></div>
                    <div class="swiper-button-next"></div>
                </div>
            </div>
        `,
        autoplay: `
            <div id="{{id}}" class="swiper-container">
                <div class="swiper">
                    <div class="swiper-wrapper">
                        {{slides}}
                    </div>
                    <div class="swiper-button-toggle" role="button" tabindex="0" aria-label="Stop autoplay"></div>
                    <div class="swiper-button-prev"></div>
                    <div class="swiper-button-next"></div>
                </div>
            </div>
        `
    },

    marquees: {
        default: `
            <div id="{{id}}" class="marquee6k" data-speed="0.5" data-pausable="true" tabindex="0">
                <div class="marquee-track">
                    <div class="marquee-content">
                        {{items}}
                    </div>
                </div>
            </div>
        `
    },

    slides: {
        movie: `
            <div class="swiper-slide">
                <a href="{{url}}">
                    {{title}}
                </a>
            </div>
        `,
        marqueeTest: `
            <div class="marquee-item">
                <a href="{{url}}">
                    {{title}}
                </a>
            </div>
        `
    }
};