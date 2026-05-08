# Slider Framework

A data-driven content slider system that renders personalized sliders on whitelisted pages based on user segment. Supports two slider libraries: [Swiper](https://swiperjs.com/) and [Marquee6k](https://www.npmjs.com/package/marquee6k).

---

## How it works

On page load, the framework:

1. Reads the current page name from the URL path
2. Bails out if the page isn't whitelisted
3. Renders placeholder "Loading..." slides while data fetches
4. Fetches slider data, segment config, templates, and user context in parallel
5. Resolves which sliders to show based on the user's segment
6. Builds production HTML from templates
7. Loads the required slider library (Swiper, Marquee6k, or both) from CDN
8. Initializes the slider instances

---

## File structure

```
public/
  slider_framework.js       # Core framework — do not edit unless extending the system
  slider_styles.css         # Base styles
  data/
    sliders.json            # Slide content (the actual items in each slider)
    sliders.config.json     # Per-slider configuration
    slider.templates.json   # HTML templates for rows, sliders, and slides
    movies.segments.json    # Which sliders show on /movies per user segment
    shows.segments.json     # Which sliders show on /shows per user segment
```

---

## Key data files

### `sliders.json` — slide content

Each key is a slider ID. The value is an array of slide objects. Any properties you add here are available as `{{key}}` tokens in the slide template.

```json
{
  "horrorMovies": [
    { "title": "Tremors" },
    { "title": "The Blob" }
  ]
}
```

### `sliders.config.json` — slider configuration

Each key is a slider ID. The full set of options is described in the [Slider config reference](#slider-config-reference) section below.

```json
{
  "horrorMovies": {
    "id": "horrorMovies",
    "title": "Horror Movies",
    "sliderLibrary": "Swiper",
    "rowLayout": "default",
    "sliderLayout": "default",
    "slideLayout": "movie",
    "sliderMode": "group",
    "swiperOptions": {
      "autoplay": false
    }
  }
}
```

### `slider.templates.json` — HTML templates

Templates use `{{key}}` placeholders. There are three levels: `rows`, `sliders`/`marquees`, and `slides`.

```json
{
  "rows": {
    "default": "<div class=\"band\">{{slider}}</div>"
  },
  "sliders": {
    "default": "<div id=\"{{id}}\" class=\"swiper-container\">..."
  },
  "marquees": {
    "default": "<div id=\"{{id}}\" class=\"marquee6k\" data-speed=\"{{speed}}\">..."
  },
  "slides": {
    "movie": "<div class=\"swiper-slide\">{{title}}</div>"
  }
}
```

- **Rows** receive a `{{slider}}` token (the rendered slider HTML)
- **Sliders/Marquees** receive all properties from the slider config, plus `{{slides}}` or `{{items}}`
- **Slides** receive all properties from the individual slide object in `sliders.json`

### `*.segments.json` — user targeting

Each page has its own segments file. The framework finds the first segment whose `when` conditions all match the user context, then shows the sliders listed in that segment's `sliders` array — in order.

```json
{
  "segments": [
    {
      "when": { "userType": "loggedOut" },
      "sliders": ["actionMovies", "horrorMovies", "scifiMovies"]
    },
    {
      "when": { "userType": "newUser" },
      "sliders": ["favoriteMovies", "scifiMovies", "actionMovies"]
    }
  ]
}
```

---

## Page integration

A page needs three things:

1. A container element with `id="sliders"`
2. The framework script (with `defer`)
3. A `window.appConfig` object set **before** the script runs

```html
<div id="sliders"></div>
<script src="slider_framework.js" defer></script>

<script>
  window.appConfig = {
    isLoggedIn: true,
    userSegment: 'newUser',   // overrides isLoggedIn-based fallback
    favorites: {
      favoriteMovies: [
        { title: "Conan the Barbarian" }
      ]
    }
  };
</script>
```

### `window.appConfig` properties

| Property | Type | Description |
|---|---|---|
| `isLoggedIn` | boolean | Used as a fallback to determine `userType` (`loggedIn` or `loggedOut`) |
| `userSegment` | string | Directly sets `userType` — takes precedence over `isLoggedIn` |
| `favorites` | object | Slider data injected for the current user (same shape as `sliders.json`) |

---

## Slider config reference

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier — must match the key in `sliders.json` and be used as the DOM `id` |
| `title` | string | Yes | Display title (available as `{{title}}` in templates) |
| `sliderLibrary` | `"Swiper"` \| `"Marquee6k"` | Yes | Which library to use |
| `rowLayout` | string | Yes | Key into `templates.rows` |
| `sliderLayout` | string | Yes | Key into `templates.sliders` or `templates.marquees` |
| `slideLayout` | string | Yes | Key into `templates.slides` |
| `sliderMode` | `"single"` \| `"group"` \| `"page"` | No | Swiper only. Defaults to `"single"` |
| `swiperOptions` | object | No | Swiper only. Merged on top of defaults — see [Swiper options](#swiper-options) |
| `breakpoints` | object | No | Swiper only. Keyed by min-width in px — see [Breakpoints](#breakpoints) |
| `speed` | string/number | No | Marquee only. Scroll speed passed to `data-speed` |

---

## Slider modes (Swiper)

| Mode | Behavior |
|---|---|
| `single` | Centered slides, one group at a time |
| `group` | Left-aligned, advances by a full group of visible slides |
| `page` | Shows exactly one slide at a time (full-width) |

---

## Swiper options

`swiperOptions` in the config are merged on top of the framework defaults. Useful overrides:

```json
"swiperOptions": {
  "autoplay": true,
  "spaceBetween": 20,
  "speed": 600
}
```

Set `autoplay: true` for default autoplay settings, or pass an object to customize:

```json
"autoplay": {
  "delay": 3000,
  "pauseOnMouseEnter": true
}
```

To show a play/pause toggle button, use the `"autoplay"` slider layout template, which includes a `.swiper-button-toggle` element.

---

## Breakpoints

Override mode and Swiper options at specific viewport widths:

```json
"breakpoints": {
  "768": {
    "sliderMode": "group",
    "swiperOptions": { "spaceBetween": 20 }
  },
  "1200": {
    "sliderMode": "single"
  }
}
```

---

## Adding a new slider

1. **Add slide data** to `public/data/sliders.json`:
   ```json
   "thrillerMovies": [
     { "title": "Rear Window" },
     { "title": "Vertigo" }
   ]
   ```

2. **Add a slider config** to `public/data/sliders.config.json`:
   ```json
   "thrillerMovies": {
     "id": "thrillerMovies",
     "title": "Thriller Movies",
     "sliderLibrary": "Swiper",
     "rowLayout": "default",
     "sliderLayout": "default",
     "slideLayout": "movie",
     "sliderMode": "group"
   }
   ```

3. **Add it to a segment** in the relevant `*.segments.json`:
   ```json
   {
     "when": { "userType": "loggedOut" },
     "sliders": ["thrillerMovies", "actionMovies"]
   }
   ```

---

## Adding a new page

1. Add the page name to `WHITELISTED_PAGES` in `slider_framework.js`:
   ```js
   const WHITELISTED_PAGES = new Set(['movies', 'shows', 'myNewPage']);
   ```

2. Add a placeholder count in `PLACEHOLDER_COUNTS`:
   ```js
   const PLACEHOLDER_COUNTS = { movies: 3, shows: 2, myNewPage: 2 };
   ```

3. Create `public/data/myNewPage.segments.json` following the same format as `movies.segments.json`.

4. Create the HTML page with the container, script tag, and `window.appConfig`.

---

## Favorites

Favorites are per-user slider data injected through `window.appConfig.favorites`. They are merged with the static `sliders.json` data, so a favorites slider works exactly like any other — it just needs a matching config entry in `sliders.config.json` and a reference in the user's segment.

```js
window.appConfig = {
  userSegment: 'newUser',
  favorites: {
    favoriteMovies: [
      { title: "Conan the Barbarian" }
    ]
  }
};
```

> **Note:** `fetchUserContext()` currently reads from `window.appConfig`. When a real session API is available, replace that function with an API call.
