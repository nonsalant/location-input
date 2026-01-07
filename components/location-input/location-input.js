import { defineElement, } from '../base/utils.js';

const COMPONENT_PATH = import.meta.resolve('./');
const { Base, getHtml, } = await import(`../base/base.js?path=${encodeURIComponent(COMPONENT_PATH)}`);

import { MarkerDataEvent, getAddressFromCoordinates } from "../map-picker/utils.js";

export default class LocationInput extends Base {
    static styles = ['critical.css',];
    // static enableShadowRoot = true;

    // demo implementation
    handleLocationConfirm(props) {
        // Log + inject coordinates and address when 'map-picker-confirm' custom event is fired
        console.log(`[${props.lat}, ${props.lng}]: ${props.address}`);
        const outputEl = this.domRoot.querySelector('output');
        outputEl.innerHTML = `<ul>
            <li>latitude: ${props.lat}</li>
            <li>longitude: ${props.lng}</li>
            <li>address: ${props.address}</li>
        </ul>`;
    }
    
    // demo implementation
    handleLocationReset() {
        // Clear the <output> element when the 'map-picker-reset' custom event is fired
        const outputEl = this.domRoot.querySelector('output');
        outputEl.innerText = '';
    }
    
    constructor() {
        super();

        document.addEventListener('location-confirm', async (e) => {
            this.setAttribute('has-location', '');
            this.handleLocationConfirm({ lat: e.lat, lng: e.lng, address: e.address });
        });
        
        document.addEventListener('location-reset', () => {
            this.removeAttribute('has-location');
            this.handleLocationReset();
        });
        
    }

    // async render() { return await getHtml('location-input.html'); }

    async render() {
        if (this.hasAttribute('inner-contents')) {
            return await getHtml(this.getAttribute('inner-contents'));
        }
    }

    afterRender() {
        // Import LazyModal component script
        import('../lazy-modal/lazy-modal.js');

        document.addEventListener('map-picker-confirm', async (e) => {
            // 📡 Dispatch a 'location-confirm' event
            // const { MarkerDataEvent } = await import('../map-picker/map-picker.js');
            document.dispatchEvent(new MarkerDataEvent('location-confirm', e.lat, e.lng, e.address));
        });

        document.addEventListener('map-picker-reset', () => {
            // 📡 Dispatch a 'location-reset' event
            document.dispatchEvent(new Event('location-reset'));
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
                    document.dispatchEvent(new MarkerDataEvent('location-confirm', coords.lat, coords.lng, address));
                }).catch(error => console.error(error) );
            });
        });
 
        // Initialize shiny cursor effect
        this.cleanupShinyCursor = initShinyCursor(this.domRoot.querySelector('#location-wrapper'));

        // 📡 When a .map-trigger is clicked add a 'location-confirm' event listener that closes the popover
        this.domRoot.querySelectorAll('.map-trigger').forEach(button => {
            button.addEventListener('click', (event) => {
                const popover = event.target.closest('[popover]');
                document.addEventListener('location-confirm', () => {
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