import '../lazy-modal/lazy-modal.js';

import { defineElement, } from '../base/utils.js';

const COMPONENT_PATH = import.meta.resolve('./');
const { Base, getHtml, } = await import(`../base/base.js?path=${encodeURIComponent(COMPONENT_PATH)}`);

// import { MarkerDataEvent, getAddressFromCoordinates } from '../map-picker/map-picker.js';

export default class LocationInput extends Base {
    static styles = ['critical.css',];
    // static enableShadowRoot = true;
    
    constructor() {
        super();

        // demo implementation
        const outputEl = this.domRoot.querySelector('output');

        // Inject coordinates and address when 'map-picker-confirm' custom event is fired
        document.addEventListener('map-picker-confirm', (e) => {
            this.setAttribute('has-location', '');
            console.log(`[${e.lat}, ${e.lng}]: ${e.address}`);
            outputEl.innerHTML = `<ul>
                <li>latitude: ${e.lat}</li>
                <li>longitude: ${e.lng}</li>
                <li>address: ${e.address}</li>
            </ul>`;
        });

        // Clear the <output> element when the 'map-picker-reset' custom event is fired
        document.addEventListener('map-picker-reset', () => {
            this.removeAttribute('has-location');
            outputEl.innerText = '';
        });
    }

    async render() { return await getHtml('location-input.html'); }

    afterRender() {
        // 📡 When a .map-trigger is clicked add a 'map-picker-confirm' event listener to close the popover
        this.domRoot.querySelectorAll('.map-trigger').forEach(button => {
            button.addEventListener('click', (event) => {
                const popover = event.target.closest('[popover]');
                document.addEventListener('map-picker-confirm', () => {
                    // closes the #location-wrapper popover:
                    popover?.hidePopover(); // but also closes the #map-wrapper popover on top of it
                }, { once: true });
            });
        });

        // Reset location when any .reset-location element is clicked
        this.domRoot.querySelectorAll('.reset-location')?.forEach(el => {
            // doesn't reach inside lazy-modal if it didn't load
            el.addEventListener('click', (e) => {
                // 📡 Dispatch a 'map-picker-reset' event
                document.dispatchEvent(new Event('map-picker-reset'));
                this.domRoot.querySelector('#map-wrapper').removeAttribute('marker-coordinates');
                this.domRoot.querySelector('map-picker')?.removeAttribute('marker-coordinates');
                // console.log('Location reset.');
                this.domRoot.querySelector('#location-wrapper')?.hidePopover();
            });
        });

        // Handle geolocation when .geo-locate button is clicked
        this.domRoot.querySelectorAll('.geo-locate').forEach(button => {
            button.addEventListener('click', async event => {
                const target = event.target;
                target.setAttribute('aria-busy', 'true');
                const { MarkerDataEvent, getAddressFromCoordinates } = await import('../map-picker/map-picker.js');
                requestClientLocation().then(async coords => {
                    const address = await getAddressFromCoordinates(coords.lat, coords.lng);
                    target.removeAttribute('aria-busy');
                    target.closest('[popover]')?.hidePopover()
                    this.domRoot.querySelector('#map-wrapper').setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    this.domRoot.querySelector('map-picker')?.setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    document.dispatchEvent(new MarkerDataEvent('map-picker-confirm', coords.lat, coords.lng, address));
                }).catch(error => console.error(error) );
            });
        });
 
        // Initialize shiny cursor effect
        this.cleanupShinyCursor = initShinyCursor(this.domRoot.querySelector('#location-wrapper'));
    }

    // Statically define (or rename) the element unless ?define=false is set in the URL
    static {
        const tag = new URL(import.meta.url).searchParams.get('define');
        defineElement(tag, this);
    }
}


// utils.js

export function requestClientLocation(decimals = 6) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve({
                lat: position.coords.latitude.toFixed(decimals),
                lng: position.coords.longitude.toFixed(decimals)
            }),
            error => {
                if (error.code === 2) {
                    alert('Location detection unavailable due to network or hardware issues.');
                }
                reject(`Error occurred. Error code: ${error.code}`);
            }
        );
    });
}
// Usage example:
// requestClientLocation().then(coords => {
//     console.log(coords.lat, coords.lng);
// }).catch(error => console.error(error) );


export function initShinyCursor(surface) {
    const handleMouseMove = (e) => {
        surface.style.setProperty('--x', e.x + 'px');
        surface.style.setProperty('--y', e.y + 'px');
    };

    surface.addEventListener('mousemove', handleMouseMove);

    // Return cleanup function to remove event listener
    return () => {
        surface.removeEventListener('mousemove', handleMouseMove);
    };
}