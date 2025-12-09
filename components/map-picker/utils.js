// Custom event to encapsulate marker data


export class MarkerDataEvent extends Event {
    constructor(eventName, lat, lng, address) {
        super(eventName, { bubbles: true, composed: true });
        this.lat = lat;
        this.lng = lng;
        this.address = address;
    }
}
// Usage example:
// el.dispatchEvent(new MarkerDataEvent('map-picker-confirm', lat, lng, address));
// Utils.

/**
 * Observes an element for intersection with the viewport
 * @param {HTMLElement} element - The element to observe
 * @param {Function} callback - The function to call when the element is intersecting
 * @param {boolean} [once=true] - If true, the observer will unobserve the element after the first intersection
 * @return {IntersectionObserver} The IntersectionObserver instance
 * @example
 * observeIntersection(document.querySelector('#myElement'), () => {
 *     console.log('Element is in view!');
 * });
*/
export function observeIntersection(element, callback) {
    Object.assign(new IntersectionObserver(([{ isIntersecting }]) => isIntersecting && callback()
    )).observe(element);
}
/**
 * Utility to convert a CSV string into an array of trimmed, non-empty strings
 * @param {string} csvString - The CSV string to convert
 * @param {string} [delimiter=','] - The delimiter to split on (defaults to comma)
 * @returns {Array<string>} A new array with trimmed, non-empty strings from the CSV
 * @example
 * csvToArray('apple, banana, cherry'); // Returns ['apple', 'banana', 'cherry']
 * csvToArray('apple; banana; cherry', ';'); // Returns ['apple', 'banana', 'cherry']
 * csvToArray('  hello  ,  world  , , foo '); // Returns ['hello', 'world', 'foo']
 */

export function csvToArray(csvString, delimiter = ',') {
    if (typeof csvString !== 'string') return [];
    if (csvString.trim() === '') return [];

    return csvString
        .split(delimiter)
        .map(item => item.trim())
        .filter(item => item); // Filter out empty strings
}
/**
 * ReverseGeocoder provides reverse geocoding functionality with caching and debounced requests.
 *
 * It converts latitude and longitude coordinates into human-readable addresses by querying
 * the Nominatim OpenStreetMap API. To optimize performance and reduce network traffic, it:
 *
 * - Caches results for previously requested coordinates.
 * - Debounces rapid requests using a leading call strategy to respond immediately on the first call.
 * - Deduplicates concurrent requests for the same coordinates.
 *
 * @class
 */
class ReverseGeocoder {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.DEBOUNCE_DELAY = 1000;

        this.debounceTimer = null;
        this.hasExecutedImmediately = false;
        this.pendingResolvers = [];
        this.lastArgs = null; // To hold latest lat,lng for trailing call
    }

    /**
     * Get address from coordinates with leading debounce and caching
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<string|null>} Address or null on error
     */
    async getAddressFromCoordinates(lat, lng) {
        const cacheKey = `${lat},${lng}`;

        // Return cached result if available
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Return existing promise if request is pending
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        // If leading call not executed recently, execute immediately
        if (!this.hasExecutedImmediately) {
            this.hasExecutedImmediately = true;

            const immediatePromise = this.#fetchAddress(lat, lng)
                .then(result => {
                    this.cache.set(cacheKey, result);
                    this.pendingRequests.delete(cacheKey);

                    // Resolve any queued resolvers with this result
                    this.pendingResolvers.forEach(resolve => resolve(result));
                    this.pendingResolvers = [];

                    return result;
                })
                .finally(() => {
                    // Reset flag after debounce delay
                    setTimeout(() => {
                        this.hasExecutedImmediately = false;
                        // If there are queued calls, trigger trailing execution
                        if (this.pendingResolvers.length > 0 && this.lastArgs) {
                            this.#executeTrailing();
                        }
                    }, this.DEBOUNCE_DELAY);
                });

            this.pendingRequests.set(cacheKey, immediatePromise);
            return immediatePromise;
        }

        // For calls during debounce window, queue resolvers and update lastArgs
        this.lastArgs = { lat, lng };

        const trailingPromise = new Promise(resolve => {
            this.pendingResolvers.push(resolve);
        });

        // Clear and reset debounce timer for trailing call
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.#executeTrailing();
        }, this.DEBOUNCE_DELAY);

        return trailingPromise;
    }

    // Internal method to execute trailing call with latest args
    async #executeTrailing() {
        if (!this.lastArgs) return;

        const { lat, lng } = this.lastArgs;
        const cacheKey = `${lat},${lng}`;

        try {
            const result = await this.#fetchAddress(lat, lng);
            this.cache.set(cacheKey, result);
            this.pendingResolvers.forEach(resolve => resolve(result));
        } catch {
            this.pendingResolvers.forEach(resolve => resolve(null));
        } finally {
            this.pendingResolvers = [];
            this.pendingRequests.delete(cacheKey);
            this.lastArgs = null;
        }
    }

    /**
     * Fetch address from coordinates (uncached)
     * @private
     */
    async #fetchAddress(lat, lng) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const params = new URLSearchParams({
                format: 'json',
                lat,
                lon: lng,
                zoom: 18,
                addressdetails: 0
            });

            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
                headers: { 'User-Agent': 'map-picker/1.0' },
                signal: controller.signal
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return data.display_name || null;
        } catch (error) {
            console.error('Geocoding failed:', error);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
// Export a singleton instance of ReverseGeocoder
const geocoder = new ReverseGeocoder();
export const getAddressFromCoordinates = geocoder.getAddressFromCoordinates.bind(geocoder);
// Usage example:
// getAddressFromCoordinates(40.748817, -73.985428).then(address => {
//     console.log(address);
// }).catch(error => console.error(error));
// or
// const address = await getAddressFromCoordinates(40.748817, -73.985428);
/**
 * Sets up keyboard controls for a Leaflet map
 * @param {HTMLElement} mapElement - The map container element
 * @param {Object} mapInstance - The Leaflet map instance
 * @param {Object} callbacks - Object containing callback functions
 * @param {Function} callbacks.setMarker - Function to set marker at coordinates
 * @param {Function} callbacks.resetMap - Function to reset the map
 * @param {Function} callbacks.confirmLocation - Function to confirm location
 * @param {Function} callbacks.markerSetEvent - Function to dispatch marker set event
 */
export function setupKeyboardControls(mapElement, mapInstance, callbacks) {
    const { setMarker, resetMap, confirmLocation, markerSetEvent } = callbacks;

    const keyHandlers = {
        'Space': (e) => {
            if (e.target.matches('[role=button]')) {
                e.target.click();
                return;
            }
            e.preventDefault();
            const center = mapInstance.getCenter();
            setMarker(center.lat, center.lng);
            markerSetEvent();
        },
        'Enter': (e) => {
            if (e.target.matches('[role=button]')) return; // Ignore if focused on a button
            if (e.target.matches('a')) return; // Ignore if focused on a link
            e.preventDefault();
            confirmLocation();
        },
        'Minus': (e) => {
            e.preventDefault();
            mapInstance.zoomOut();
        },
        'Equal': (e) => {
            e.preventDefault();
            mapInstance.zoomIn();
        },
        'ArrowUp': (e) => {
            e.preventDefault();
            mapInstance.panBy([0, -50]);
        },
        'ArrowDown': (e) => {
            e.preventDefault();
            mapInstance.panBy([0, 50]);
        },
        'ArrowLeft': (e) => {
            e.preventDefault();
            mapInstance.panBy([-50, 0]);
        },
        'ArrowRight': (e) => {
            e.preventDefault();
            mapInstance.panBy([50, 0]);
        },
        'End': (e) => {
            e.preventDefault();
            mapInstance.setZoom(4);
        },
        'KeyR': (e) => {
            e.preventDefault();
            resetMap();
        },
        'KeyH': (e) => {
            e.preventDefault();
            alert('Map Keyboard Shortcuts:\n\n' +
                'Space: Place marker at map center\n' +
                'Enter: Confirm location\n' +
                'Plus/Minus: Zoom in/out\n' +
                'Arrow keys: Pan map\n' +
                'R: Reset map\n' +
                'Escape: Close popover'
            );
        }
    };

    mapElement.addEventListener('keydown', (e) => {
        if (e.metaKey) return;
        if (e.ctrlKey) return;
        const handler = keyHandlers[e.code];
        if (handler) handler(e);
    });
}
