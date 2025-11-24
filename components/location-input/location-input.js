const COMPONENT_PATH = import.meta.resolve('./');
const {
    Base,
    getHtml,
    defineElement,
} = await import(`../base/base.js?path=${encodeURIComponent(COMPONENT_PATH)}`);

// import { MarkerDataEvent, getAddressFromCoordinates } from '../map-picker/map-picker.js';

export default class LocationInput extends Base {
    constructor() {
        super();

        // demo implementation
        const outputEl = document.querySelector('output');

        // Inject coordinates and address when 'map-picker-confirm' custom event is fired
        document.addEventListener('map-picker-confirm', (e) => {
            // console.log(`[${e.lat}, ${e.lng}]: ${e.address}`);
            outputEl.innerHTML = `<ul>
                <li>latitude: ${e.lat}</li>
                <li>longitude: ${e.lng}</li>
                <li>address: ${e.address}</li>
            </ul>`;
        });

        // Clear the <output> element when the 'map-picker-reset' custom event is fired
        document.addEventListener('map-picker-reset', () => { outputEl.innerText = ''; });
    }

    async render() { return await getHtml('location-input.html'); }

    afterRender() {

        // Handle geolocation when .geo-locate button is clicked
        this.querySelectorAll('.geo-locate').forEach(button => {
            button.addEventListener('click', (event) => {
                // this.handleClientLocation();
                requestClientLocation().then(async coords => {
                    event.target.setAttribute('aria-busy', 'true'); // gets removed in map-picker after processing
                    const { MarkerDataEvent, getAddressFromCoordinates } = await import('../map-picker/map-picker.js');

                    const address = await getAddressFromCoordinates(coords.lat, coords.lng);
                    event.target.removeAttribute('aria-busy');
                    event.target.closest('[popover]')?.hidePopover()

                    this.querySelector('#map-wrapper').setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    this.querySelector('map-picker')?.setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    document.dispatchEvent(new MarkerDataEvent('map-picker-confirm', coords.lat, coords.lng, address));
                }).catch(error => console.error(error) );
            });
        });

        // when .map-trigger button is clicked add an event listener to close popover (on the map-picker-confirm event) 
        this.querySelectorAll('.map-trigger').forEach(button => {
            button.addEventListener('click', (event) => {
                document.addEventListener('map-picker-confirm', () => {
                    event.target.closest('[popover]')?.hidePopover();
                }, { once: true });
            });
        });

        // Reset location when any .reset-location element is clicked
        this.querySelectorAll('.reset-location')?.forEach(el => {
            el.addEventListener('click', (e) => {
                // 📡 Dispatch a 'map-picker-reset' event
                document.dispatchEvent(new Event('map-picker-reset'));
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

export function requestClientLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            error => {
                if (error.code === 2) {
                    alert('Position unavailable: Network or hardware issues are preventing location detection.');
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