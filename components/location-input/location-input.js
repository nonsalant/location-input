const componentPath = import.meta.resolve('./');
const {
    Base,
    getHtml,
    defineElement,
    processPlaceholders,
    createFragment
} = await import(`../base/base.js?path=${encodeURIComponent(componentPath)}`);

export default class LocationInput extends Base {
    constructor() {
        super();
    }

    connected() {


        this.querySelectorAll('.geo-locate').forEach(button => {
            button.addEventListener('click', () => {
                // this.handleClientLocation();
                requestClientLocation().then(coords => {
                    // todo: map-picker may not be present yet -- set coordinates on the location-input itself(?)
                    this.querySelector('map-picker').setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    // dispatchEvent('map-picker-confirm', { detail: coords });
                }).catch(error => console.error(error) );
            });
        });
    }

    // handleClientLocation() {
    //     requestClientLocation().then(coords => {
    //         const { lat, lng } = coords;
    //         console.log('Client coordinates:', lat, lng);
    //         // this.findStation(lat, lng);
    //         // // 'marker-coordinates' may be used in the map-picker component (if opened)
    //         // const element = this.shadowRoot.querySelector('map-picker') ?? this.mapWrapper;
    //         // element.setAttribute('marker-coordinates', `${lat},${lng}`);
    //     }).catch(error => console.error(error)
    //     ).finally(() => {
    //         // this.geoLocate.ariaBusy = null; // reset aria-busy state
    //     });
    // }

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