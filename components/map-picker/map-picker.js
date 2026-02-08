const { defineElement, kbdOnly } = await import('../../lib/utils/base.js');
import { csvToArray, observeIntersection, setupKeyboardControls, getAddressFromCoordinates, MarkerDataEvent } from "../../lib/utils/map-picker.js";

let Leaflet; // Will be imported dynamically in connectedCallback()

/* 🏠 Local version */
const BASE_URL = import.meta.resolve('../../lib/vendor-leaflet/');
const LEAFLET_SCRIPT = 'leaflet-src.esm.min.js';
const LEAFLET_STYLESHEET = 'leaflet.min.css';

/* 🔗 CDN version */
// const BASE_URL = 'https://unpkg.com/leaflet@1.9.4/dist/';
// const LEAFLET_SCRIPT = 'leaflet-src.esm.js';
// const LEAFLET_STYLESHEET = 'leaflet.css';

export default class MapPicker extends HTMLElement {
    static get observedAttributes() { return ['marker-coordinates']; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return; // No change, no action
        if (name === 'marker-coordinates' && newValue) {
            const coords = csvToArray(newValue).map(Number);
            this.setMarker(coords[0], coords[1]);
        }
    }

    static {
        // Preload appropriate marker icon based on device pixel ratio
        new Image().src = window.devicePixelRatio >= 2 
            ? `${BASE_URL}images/marker-icon-2x.png`
            : `${BASE_URL}images/marker-icon.png`;
    }

    constructor() {
        super();
        const host = this.#determineHost();
        
        this.mapWrapper = this.closest('[popover]') ?? this.parentElement
            ?? this.getRootNode().host;
        this.confirmLocation = host.querySelectorAll(this.getAttribute('confirm') || '.confirm-location');
        this.resetLocation = host.querySelectorAll(this.getAttribute('reset') || '.reset-location');
        this.cancelLocation = host.querySelectorAll(this.getAttribute('cancel') || '.cancel-location');
        this.initialCoords = this.hasAttribute('initial-coordinates')
            ? csvToArray(this.getAttribute('initial-coordinates')).map(Number)
            : [39.8283, -98.5795]; // Default to USA center
        this.initialZoom = parseInt(this.getAttribute('initial-zoom')) || 4; // Default zoom level
        this.map = null;
        this.marker = null;
        this.address = null; // Store the address of the marker

        const kbdOnlyElements = host.querySelectorAll('.js-hidden-if-no-kbd');
        kbdOnly(kbdOnlyElements);
    }

    #determineHost() {
        const host = this.getAttribute('map-host');
        if (host)
            return document.querySelector(host)?.shadowRoot
            || document.querySelector(host);
        return this.getRootNode(); // 'document' or a shadow root
    }

    connectedCallback() {
        this.ariaBusy = true; // Initially busy while loading

        // Load Leaflet first, then initialize
        import(`${BASE_URL}${LEAFLET_SCRIPT}`).then(module => {
            Leaflet = module;
            this.#init();
        }).catch(error => console.error('Failed to load Leaflet:', error));

        // Add the Leaflet CSS stylesheet
        this.addStylesheet(`${BASE_URL}${LEAFLET_STYLESHEET}`);
    }

    addStylesheet(path) {
        return new Promise((resolve) => {
            const element = document.createElement('link');
            element.rel = 'stylesheet';
            element.href = `${path}`;
            element.onload = () => resolve();
            element.onerror = (error) => {
                console.warn(`map-picker.js failed to load stylesheet: ${path}`, error);
                resolve(); // Still resolve to not block other resources
            };
            this.prepend(element);
        });
    }

    #init() {
        this.#setupMap();
        this.#setupIntersectionObserver();
        this.#setupEventListeners();
    }

    #setupMap() {
        // Set the default icon path for Leaflet
        Leaflet.Icon.Default.prototype.options.imagePath = `${BASE_URL}images/`;

        // Create map without default zoom control and attribution
        this.map = new Leaflet.Map(this, {
            zoomControl: false,
            attributionControl: false,
        }).setView(this.initialCoords, this.initialZoom);
        // Add zoom control to the right side
        new Leaflet.Control.Zoom({ position: 'topright' }).addTo(this.map);

        const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const attribution = MapPicker.#mapAttribution();
        const tileLayer = new Leaflet.TileLayer(tileUrl, {maxZoom: 19, attribution: attribution});
        this.#setAriaBusyWhenLoading(tileLayer);

        this.map.addLayer(tileLayer);

        this.#inheritMarkerCoordinates();
    }

    #inheritMarkerCoordinates() {
        // move attribute 'marker-coordinates' from mapWrapper to this component
        if (!this.mapWrapper.hasAttribute('marker-coordinates')) return;
        const coords = this.mapWrapper.getAttribute('marker-coordinates');
        this.mapWrapper.removeAttribute('marker-coordinates'); // Clean up attribute
        this.setAttribute('marker-coordinates', coords);
    }

    #setupIntersectionObserver() {
        // Intersection Observer to recalculate map size when it becomes visible
        observeIntersection(this.mapWrapper, () => {
            this.map.invalidateSize();
            this.#refreshMarker();
            if (this.hasAttribute('map-autofocus')) this.map.getContainer().focus();
        }, false); // the false flag means it will not unobserve after the first intersection
    }

    #refreshMarker() {
        if (!this.hasAttribute('marker-coordinates')) return;
        const coords = csvToArray(this.getAttribute('marker-coordinates')).map(Number);
        this.setMarker(coords[0], coords[1]);
        this.map.setView(coords, 12);
    }

    #setupEventListeners() {
        this.map.on('click', (e) => {
            this.setMarker(e.latlng.lat, e.latlng.lng);
            this.#dispatchEventWithMarkerData('map-picker-marker-set');
        });

        setupKeyboardControls(this.map.getContainer(), this.map, {
            setMarker: (lat, lng) => this.setMarker(lat, lng),
            resetMap: () => this.resetMap(),
            confirmLocation: () => this.confirmLocation[0]?.click(),
            markerSetEvent: () => this.#dispatchEventWithMarkerData('map-picker-marker-set')
        });

        this.confirmLocation?.forEach(el => {
            el.addEventListener('click', (e) => this.handleConfirm(e));
        });
    
        this.resetLocation?.forEach(el => {
            el.addEventListener('click', (e) => {
                // 📡 Dispatch a 'map-picker-reset' event
                const host = this.#determineHost().host || this.#determineHost(); // Get the host element (document or shadow root)
                // console.log('Dispatching map-picker-reset event from', host);
                host.dispatchEvent(new Event('map-picker-reset', { bubbles: true, composed: true }));
                // document.querySelector('#location-wrapper')?.hidePopover();
                // document.querySelector('location-input')?.shadowRoot?.querySelector('#location-wrapper').hidePopover();
                host.querySelector('#location-wrapper')?.hidePopover();
                host.getRootNode().querySelector('#location-wrapper')?.hidePopover();
                // this.removeAttribute('marker-coordinates');
            });
        });

        this.cancelLocation?.forEach(el => {
            el.addEventListener('click', (e) => {
                this.mapWrapper?.hidePopover();
            });
        });

        // 📡 Listen for the map-picker-reset event
        const host = this.#determineHost();
        host.addEventListener('map-picker-reset', () => { this.resetMap() });
        // document.addEventListener('map-picker-reset', () => { this.resetMap() });
    }

    handleConfirm(e) {
        if (!this.marker) return alert('Please select a location on the map first.');

        const { lat, lng } = this.marker.getLatLng();
        this.setAttribute('marker-coordinates', `${lat},${lng}`);
        this.map.setView([lat, lng], 12);

        // 📡 Dispatch a custom event to notify that the location has been confirmed
        this.#dispatchEventWithMarkerData('map-picker-confirm');
        // this.confirmLocation?.forEach(el => el.ariaBusy = true);
    }

    async setMarker(lat, lng, showPopup = true) {
        if (!Leaflet) return; // ! Leaflet is not loaded

        // Set marker at given coordinates and fetch address
        if (this.marker) this.map.removeLayer(this.marker);
        this.marker = new Leaflet.Marker([lat, lng]).addTo(this.map);

        // Show popup with loading state
        const popup = this.marker.bindPopup(MapPicker.#createPopup({ loading: true }));
        if (showPopup) popup.openPopup();

        // Get address and update popup
        const address = await getAddressFromCoordinates(lat, lng);
        this.address = address || null;
        this.marker.setPopupContent(MapPicker.#createPopup({ address, coordinates: { lat, lng } }));
    }

    resetMap() {
        if (this.marker) this.map.removeLayer(this.marker);
        this.marker = null; // Clear marker reference
        this.address = null; // Clear the address
        this.removeAttribute('marker-coordinates'); // Clean up attribute
        this.map.setView(this.initialCoords, this.initialZoom);
        // this.map.getContainer().focus();
    }

    #setAriaBusyWhenLoading(tileLayer) {
        let loadingTiles = 0; // Track loading tiles count
        tileLayer.on('loading', () => {
            loadingTiles++;
            this.ariaBusy = true;
        });
        tileLayer.on('load', () => {
            loadingTiles--;
            if (!loadingTiles) this.ariaBusy = null;
        });
    }

    // Dispatch a custom event with marker data
    #dispatchEventWithMarkerData(evName) {
        if (!this.marker) return;
        const lat = this.marker.getLatLng().lat.toFixed(6);
        const lng = this.marker.getLatLng().lng.toFixed(6);
        this.#determineHost().dispatchEvent(new MarkerDataEvent(
            evName, lat, lng, this.address || null 
        ));
    }

    // Unified popup template method
    static #createPopup({ loading = false, address = null, coordinates = null }) {
        const content = loading 
            ? MapPicker.#loadingTemplate()
            : address 
                ? MapPicker.#addressTemplate(address)
                : MapPicker.#coordinatesTemplate(coordinates.lat, coordinates.lng);
    
        return `<div class="popup-address" aria-live="polite">${content}</div>`;
    }

    static #loadingTemplate() {
        return `
            <strong>Address:</strong>
            <div aria-busy="true" class="muted">loading...</div>
        `;
    }

    static #addressTemplate(address) {
        return `
            <strong>Address:</strong>
            <div>${address}</div>
        `;
    }

    static #coordinatesTemplate(lat, lng) {
        return `
            <div class="space-between">
                <strong>Latitude:</strong> <div>${lat.toFixed(6)}</div>
            </div>
            <div class="space-between">
                <strong>Longitude:</strong> <div>${lng.toFixed(6)}</div>
            </div>
        `;
    }

    static #mapAttribution() {
        return `&copy;
            <a target="_blank" title="Open Street Maps"
                href="https://www.openstreetmap.org/copyright"
            >OSM</a> contributors |
            Geocoding by <a target="_blank" href="https://nominatim.org">Nominatim</a> |
            <a target="_blank" href="https://leafletjs.com" target="_blank"
                title="A JavaScript library for interactive maps"
            >Leaflet</a>`
    }

    // Statically define (or rename) the element unless ?define=false is set in the URL
    static {
        const tag = new URL(import.meta.url).searchParams.get('define');
        defineElement(tag, this);
    }
}