import { defineElement, generateRandomId, } from '../base/utils.js';

const COMPONENT_PATH = import.meta.resolve('./');
const { Base, getHtml, } = await import(`../base/base.js?path=${encodeURIComponent(COMPONENT_PATH)}`);

import { MarkerDataEvent, getAddressFromCoordinates } from '../map-picker/utils.js';

export default class LocationInput extends Base {
    static enableShadowRoot = true;
    static styles = ['critical.css',];

    // handleLocationConfirm(e) { console.log(`[${e.lat}, ${e.lng}]: ${e.address}`); }
    // handleLocationReset() {} 
    
    constructor() {
        super();

        this.id ||= generateRandomId([3,2]); // generate an ID like 'abc12' if none is set
        this.setAttribute('map-host', `#${this.id}`);

        if (!this.handleLocationConfirm || !this.handleLocationReset) {
            import('./defaultLocationHandlers.js').then(module => {
                Object.assign(this, module.defaultLocationHandlers);
            });
        }

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
        const hasBothModals = this.root.querySelector('#location-wrapper')
                           && this.root.querySelector('#map-wrapper');
        if (hasBothModals) {
            // this.root.innerHTML = processPlaceholders(this.innerHTML, this);  
            return;
        }
        else return await getHtml('location-input.html');
    }

    afterRender() {
        this.root.querySelector('#map-wrapper').setAttribute('map-host', this.getAttribute('map-host'));
        this.root.querySelector('#map-wrapper').addEventListener('lazy-modal-content-loaded', (e)=> {
            this.root.querySelector('map-picker')?.setAttribute('map-host', this.getAttribute('map-host'));
        });

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
            this.root.querySelector('#map-wrapper').shadowRoot?.querySelector('map-picker')?.resetMap();
        });

        // Handle geolocation when .geo-locate button is clicked
        this.root.querySelectorAll('.geo-locate').forEach(button => {
            button.addEventListener('click', async event => {
                const target = event.target;
                target.setAttribute('aria-busy', 'true');
                // const { MarkerDataEvent, getAddressFromCoordinates } = await import('../map-picker/map-picker.js');
                requestClientLocation().then(async coords => {
                    const address = await getAddressFromCoordinates(coords.lat, coords.lng);
                    target.removeAttribute('aria-busy');
                    target.closest('[popover]')?.hidePopover();
                    this.root.querySelector('#location-wrapper')?.hidePopover();
                    this.root.querySelector('#map-wrapper').setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    this.root.querySelector('map-picker')?.setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    this.root.querySelector('map-picker')?.shadowRoot?.setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    // 📡 Dispatch a 'location-confirm' event
                    this.dispatchEvent(new MarkerDataEvent('location-confirm', coords.lat, coords.lng, address));
                }).catch(error => console.error(error) );
            });
        });
 
        // Initialize shiny cursor effect
        this.cleanupShinyCursor = initShinyCursor(this.root.querySelector('#location-wrapper'));

        // 📡 When a .map-trigger is clicked add a 'location-confirm' event listener that closes the popover
        this.root.querySelectorAll('.map-trigger').forEach(button => {
            button.addEventListener('click', (event) => {
                const popover = event.target.closest('[popover]') ?? this.root.querySelector('#location-wrapper');
                // document.addEventListener('location-confirm', () => {
                this.addEventListener('location-confirm', () => {
                    // closes the #location-wrapper popover:
                    popover?.hidePopover(); // but also closes the #map-wrapper popover on top of it
                }, { once: true });
            });
        });

        // Reset location when any .reset-location element is clicked
        this.root.querySelectorAll('.reset-location')?.forEach(el => {
            // doesn't reach inside lazy-modal if it didn't load
            el.addEventListener('click', (e) => {
                // 📡 Dispatch a 'map-picker-reset' event
                this.dispatchEvent(new Event('map-picker-reset', { bubbles: true, composed: true }));
                // console.log('Location reset.');
                this.root.querySelector('#map-wrapper').removeAttribute('marker-coordinates');
                this.root.querySelector('map-picker')?.removeAttribute('marker-coordinates');
                // this.root.querySelector('#map-wrapper').shadowRoot?.querySelector('map-picker')?.removeAttribute('marker-coordinates');
                // this.root.querySelector('#map-wrapper').shadowRoot?.querySelector('map-picker')?.resetMap();
                this.root.querySelector('#location-wrapper')?.hidePopover();
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