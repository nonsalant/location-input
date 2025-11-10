// Get the component path from the URL query parameter
const componentPath = new URL(import.meta.url).searchParams.get('path');
// console.log('Base componentPath:', componentPath);

export class Base extends HTMLElement {
    static basePath = import.meta.resolve('./');
    static enableShadowRoot = false;
    static styles = [];

    // https://hawkticehurst.com/2024/05/bring-your-own-base-class/#:~:text=class%20BaseElement,-extends%20HTMLElement%20%7Bconstructor
    constructor() {
        super();
        // Attach shadow root if enabled and not already present (via declarative shadow DOM)
        const needsShadow = this.constructor.enableShadowRoot && !this.shadowRoot;
        if (needsShadow) this.attachShadow({ mode: 'open' });
        // Current shadow root or the first parent shadow root or 'document':
        this.assetHost = this.shadowRoot ?? this.getRootNode();
        // console.log(this.constructor.name, this.assetHost);
        this.domRoot = this.shadowRoot ?? this;
    }

    disconnectedCallback() { this.disconnected(); }

    connectedCallback() {
        this.connected();
        if (this.initialized) return;
        this.initialized = true;
        this.init();
    }

    async init() {
        this.addCss();

        const markup = await this.render();
        const processedHtml = processPlaceholders(markup, this);
        // or: processedHtml = processPlaceholders(markup, { myValue: 'yoo' });
        // const fragment = createFragment(processedHtml); // ! this registers the elements before they are appended to the DOM
        // this.domRoot.appendChild(fragment);
        this.domRoot.insertAdjacentHTML('beforeend', processedHtml);

        const beforeMarkup = await this.renderBefore();
        const processedBeforeHtml = processPlaceholders(beforeMarkup, this);
        // const fragmentBefore = createFragment(processedBeforeHtml);
        // this.domRoot.prepend(fragmentBefore);
        this.domRoot.insertAdjacentHTML('afterbegin', processedBeforeHtml);

        this.executeScripts(this.domRoot);

        // this.afterRender();
    }

    executeScripts(context = this) {
        context.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');

            // Copy all attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            // Copy the script content
            newScript.textContent = oldScript.textContent;

            // Replace the old script with the new one
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    disconnected() {}
    connected() {}
    // afterRender() {}
    render() { return ''; }
    renderBefore() { return ''; }

    async addCss() {
        const styles = this.constructor.styles;
        const cssTexts = await this.css(styles);
        for (const cssText of cssTexts) {
            const processedCssText = processPlaceholders(cssText, this);
            const stylesheet = await createStylesheet(processedCssText);
            // console.log(this.assetHost);
            this.assetHost.adoptedStyleSheets?.push(stylesheet);
        }
    }

    async css(styles) {
        if (typeof styles === 'string') {
            styles = [styles]; // if styles is a string make it an array
        }
        if (Array.isArray(styles)) {
            // add componentPath to each path if it doesn't look like raw CSS
            styles = styles.map(str => {
                if (typeof str !== 'string') return console.warn('Base.css: style entry is not a string:', str);
                // Heuristic: whitespace in a non-URL likely means CSS text
                if (looksLikeCssText(str)) return str; // raw css text, don't resolve as URL
                // str = new URL(str, this.constructor.basePath).href;
                str = new URL(str, componentPath).href;
                return str;
            });
            return await getCss(...styles); // promise that resolves to an array of stylesheets
        } else console.warn('Base.css: styles is not a string or array:', styles);
    }
}


// Utils
// import { createFragment, processPlaceholders, getCss, createStylesheet } from "./utils.js";

globalThis.htmlPromiseCache ??= new Map();
globalThis.cssPromiseCache ??= new Map();


/**
 * Fetches HTML content from a given path with caching support.
 * 
 * @async
 * @function getHtml
 * @param {string} path - The relative path to the HTML file
 * @param {string} [basePath=import.meta.resolve('./')] - The base path to resolve the file from
 * @returns {Promise<string|undefined>} The HTML content as a string, or undefined if fetch fails
 * @throws {Error} Throws an error if the fetch request fails
 * 
 * @description
 * This function implements a caching mechanism using globalThis.htmlPromiseCache to avoid
 * duplicate requests for the same HTML file. The path is normalized using URL constructor
 * before fetching. If a request for the same path is already in progress, it returns the
 * existing promise rather than making a new request.
 * 
 * @example
 * const html = await getHtml('template.html'); // Fetch from the componentPath
 * 
 * @example
 * const html = await getHtml('components/header.html', 'https://example.com/'); // Fetch from path
 */
export async function getHtml(path, basePath = componentPath) {
    path = `${basePath}${path}`;
    path = new URL(path, basePath).href; // normalize path
    try {
        // Check if we already have a promise for this file
        if (!globalThis.htmlPromiseCache.has(path)) {
            // Create and cache the fetch promise
            const fetchPromise = fetch(path).then(response => {
                if (!response.ok) throw new Error(`Failed to fetch html: ${path}`);
                return response.text();
            });
            globalThis.htmlPromiseCache.set(path, fetchPromise);
        }
        // Await the cached promise
        return await globalThis.htmlPromiseCache.get(path);
    } catch (error) { console.error('Failed to load html:', error); }
}

/**
 * Fetch and cache CSS stylesheets.
 * @param {string} basePath - The base path for resolving stylesheet URLs.
 * @param {...string} stylesheetPaths - The paths to the stylesheets to fetch.
 * @returns {Promise<string[]>} A promise that resolves to an array of CSS stylesheets.
 */
export async function getCss(...stylesheetPaths) {
    const stylesheets = [];
    for (let path of stylesheetPaths) {
        // path = `${basePath}${path}`;
        // path = new URL(path, basePath).href; // normalize path
        // console.log(path);

        // If it's not a string just skip/fallback
        if (typeof path !== 'string') continue;

        // Detect raw CSS text: contains newline, braces, semicolon, or whitespace but not a URL-like scheme
        if (looksLikeCssText(path)) {
            const cssText = path.trim();
            if (!stylesheets.includes(cssText)) stylesheets.push(cssText);
            continue;
        }

        // Check if we already have a promise for this stylesheet
        if (!globalThis.cssPromiseCache.has(path)) {
            // Create and cache the complete stylesheet creation promise
            const stylesheetPromise = fetch(path)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch stylesheet: ${path}`);
                    return response.text();
                })
                .catch(error => {
                    console.error(`Error loading stylesheet ${path}:`, error);
                    // return new CSSStyleSheet(); // return empty stylesheet as fallback
                    return '';
                });
            globalThis.cssPromiseCache.set(path, stylesheetPromise);
        }
        // Await the cached promise
        const stylesheet = await globalThis.cssPromiseCache.get(path);
        stylesheets.push(stylesheet);
    }
    return stylesheets;
}
/***/

/**
 * Defines a custom element with the specified tag and class.
 * @param {string} tag - The tag name for the custom element.
 * @param {class} componentClass - The class definition for the custom element.
 * @see https://til.jakelazaroff.com/html/define-a-custom-element/
 */
export function defineElement(tag, component) {
    if (tag === 'false') return;
    if (tag === null) tag = camelToKebab(component.name);
    const name = customElements.getName(component); if (name) return console.warn(`${component.name} already defined as <${name}>!`);
    const el = customElements.get(tag); if (Boolean(el) && el !== component) return console.warn(`<${tag}> already defined as ${el.name}!`);
    customElements.define(tag, component);
}

/**
 * Create a DocumentFragment from an HTML string.
 * @param {string} html - HTML template string; may contain ${prop} placeholders.
 * @returns {DocumentFragment} DocumentFragment containing parsed nodes from the processed HTML.
 * @throws {TypeError} If `html` is not a string.
 */
export function createFragment(html) {
    if (typeof html !== 'string') {
        throw new TypeError('createFragment(html): expected a string');
    }
    return document.createRange().createContextualFragment(html);
}

/**
 * Replace ${prop} placeholders in an HTML template string with resolved values.
 * @param {string} html - HTML template containing ${prop} placeholders.
 * @param {Object|Element} context - The context used to resolve placeholders.
 * @returns {string} Processed HTML string with placeholders replaced.
 * @throws {TypeError} If `html` is not a string or `context` is not an object or Element.
 */
export function processPlaceholders(html, context) {
    if (html == null) return '';

    if (typeof html !== 'string') {
        throw new TypeError('processPlaceholders(html): expected a string');
    }
    if (context == null || (!['object', 'function'].includes(typeof context))) {
        throw new TypeError('processPlaceholders(context): expected an object or Element');
    }

    const toStr = v => (v == null ? '' : String(v));
        
    // Extract script tags and replace with placeholders
    const scriptTagRegex = /<script(\s[^>]*)?>[\s\S]*?<\/script>/gi;
    const scripts = [];
    let workingHtml = html.replace(scriptTagRegex, (match) => {
        scripts.push(match);
        return `<!--SCRIPT_PLACEHOLDER_${scripts.length - 1}-->`;
    });
    
    // Process placeholders only in non-script content
    const propRegex = /\$\{([^}]+)\}/g; // matches ${prop} placeholders

    workingHtml = workingHtml.replace(propRegex, (_, raw) => {
        const prop = String(raw).trim();
        // Using != null preserves falsy values like 0, false and '' while excluding null/undefined.
        // 1) dataset (attributes from data-*, automatic kebab-case conversion)
        if (context.dataset && context.dataset[prop] != null) {
            return context.dataset[prop];
        }

        // 2) attribute (Element-like API), convert camel to kebab for attribute names
        if (typeof context.getAttribute === 'function') {
            const attr = context.getAttribute(camelToKebab(prop));
            if (attr != null) return attr;
        }

        // 3) direct property lookup (supports plain objects and instances)
        if (context[prop] != null) {
            return toStr(context[prop]);
        }

        // 4) fallback to static prop
        if (context.constructor && context.constructor[prop] != null) {
            return toStr(context.constructor[prop]);
        }

        // not found -> empty string // ! breaks string literals (eg: in js in html)
        console.warn(`Property '${prop}' not found in context: ${context}`);
        // return '';
        return _;
    });
    
    // Restore script tags
    scripts.forEach((script, index) => {
        workingHtml = workingHtml.replace(`<!--SCRIPT_PLACEHOLDER_${index}-->`, script);
    });

    return workingHtml;
}

/**
 * Creates a CSSStyleSheet from CSS text
 * @param {string} cssText - The CSS text to create a stylesheet from
 * @returns {Promise<CSSStyleSheet>} A promise that resolves to a CSSStyleSheet
 */
export async function createStylesheet(cssText) {
    const stylesheet = new CSSStyleSheet();
    await stylesheet.replace(cssText);
    return stylesheet;
}

/**
 * Converts a CamelCase string into a kebab-case string
 * @param {string} str - The CamelCase string to convert
 * @returns {string} The converted kebab-case string
 * @example
 * camelToKebab('myCamelCaseString'); // 'my-camel-case-string'
 */
export function camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Detects whether a string looks like raw CSS text or a URL.
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string appears to be raw CSS text, false if it looks like a URL.
 * 
 * true if the string contains a newline, {, } or ; (common characters in CSS rules).
 * true if the string contains whitespace but is not an http(s) URL and not a data/blob/file URL (heuristic: whitespace in a non-URL likely means CSS text).
 *
 * "body { color: red; }" → true (raw CSS)
 * " .my-class { display: flex } " → true
 * "styles.css" → false
 * "https://example.com/styles.css" → false
 * "data:text/css,..." → false
 */
export function looksLikeCssText(str) {
    return /[\n\{;\}]/.test(str) || (/\s/.test(str) && !/^\s*https?:\/\//i.test(str) && !/^\s*(data|blob|file):/i.test(str));
}