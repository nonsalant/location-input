import { defineElement, } from '../base/utils.js';

const COMPONENT_PATH = import.meta.resolve('./');
const { Base, getHtml, } = await import(`../base/base.js?path=${encodeURIComponent(COMPONENT_PATH)}`);

import { MarkerDataEvent, getAddressFromCoordinates } from '../map-picker/utils.js';

// Default location event handlers 
// can be overridden via Object.assign(LocationInput.prototype, locationHandlers);
// before defining the element with customElements.define('location-input', LocationInput);
// note: import the class like this so it's not auto-defined: import LocationInput from './components/location-input/location-input.js?define=false';
const defaultLocationHandlers = {

    // Log + inject coordinates + address when 'location-confirm' custom event is fired
    handleLocationConfirm(props) {
        console.log(`[${props.lat}, ${props.lng}]: ${props.address}`);
        const outputEl = this.domRoot.querySelector('output');
        outputEl.innerHTML = `<ul>
            <li>Latitude: ${props.lat}</li>
            <li>Longitude: ${props.lng}</li>
            <li>Address: ${props.address}</li>
        </ul>`;
    },

    // Clear the <output> element when the 'location-reset' custom event is fired
    handleLocationReset() {
        const outputEl = this.domRoot.querySelector('output');
        outputEl.innerText = '';
    }

}

export default class LocationInput extends Base {
    static styles = ['critical.css',];
    // static enableShadowRoot = true;
    
    constructor() {
        super();

        const needsImplementation = typeof this.handleLocationConfirm === 'undefined' || typeof this.handleLocationReset === 'undefined';
        if (needsImplementation) Object.assign(this, defaultLocationHandlers);

        this.addEventListener('location-confirm', async (e) => {
            this.setAttribute('has-location', '');
            this.handleLocationConfirm?.({ lat: e.lat, lng: e.lng, address: e.address });
        });
        
        this.addEventListener('location-reset', () => {
            this.removeAttribute('has-location');
            this.handleLocationReset?.();
        });
        
    }

    async render() {
        const hasBothModals = this.querySelector('#location-wrapper') && this.querySelector('#map-wrapper');
        if (hasBothModals) return;
        else return await getHtml('location-input.html');
    }

    afterRender() {
        // Import LazyModal component script
        import('../lazy-modal/lazy-modal.js');

        this.addEventListener('map-picker-confirm', async (e) => {
            // 📡 Dispatch a 'location-confirm' event
            // const { MarkerDataEvent } = await import('../map-picker/map-picker.js');
            this.dispatchEvent(new MarkerDataEvent('location-confirm', e.lat, e.lng, e.address));
        });

        this.addEventListener('map-picker-reset', () => {
            // 📡 Dispatch a 'location-reset' event
            this.dispatchEvent(new Event('location-reset', { bubbles: true, composed: true }));
        });

        // Handle geolocation when .geo-locate button is clicked
        this.domRoot.querySelectorAll('.geo-locate').forEach(button => {
            button.addEventListener('click', async event => {
                const target = event.target;
                target.setAttribute('aria-busy', 'true');
                // const { MarkerDataEvent, getAddressFromCoordinates } = await import('../map-picker/map-picker.js');
                requestClientLocation().then(async coords => {
                    const address = await getAddressFromCoordinates(coords.lat, coords.lng);
                    target.removeAttribute('aria-busy');
                    target.closest('[popover]')?.hidePopover();
                    this.domRoot.querySelector('#map-wrapper').setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    this.domRoot.querySelector('map-picker')?.setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    // 📡 Dispatch a 'location-confirm' event
                    this.dispatchEvent(new MarkerDataEvent('location-confirm', coords.lat, coords.lng, address));
                }).catch(error => console.error(error) );
            });
        });
 
        // Initialize shiny cursor effect
        this.cleanupShinyCursor = initShinyCursor(this.domRoot.querySelector('#location-wrapper'));

        // 📡 When a .map-trigger is clicked add a 'location-confirm' event listener that closes the popover
        this.domRoot.querySelectorAll('.map-trigger').forEach(button => {
            button.addEventListener('click', (event) => {
                const popover = event.target.closest('[popover]');
                // document.addEventListener('location-confirm', () => {
                this.addEventListener('location-confirm', () => {
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
                this.dispatchEvent(new Event('map-picker-reset', { bubbles: true, composed: true }));
                // console.log('Location reset.');
                this.domRoot.querySelector('#map-wrapper').removeAttribute('marker-coordinates');
                this.domRoot.querySelector('map-picker')?.removeAttribute('marker-coordinates');
                // console.log('Location reset.');
                this.domRoot.querySelector('#location-wrapper')?.hidePopover();
            });
        });

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