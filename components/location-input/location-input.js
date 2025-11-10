const componentPath = import.meta.resolve('./');
const {
    Base,
    getHtml,
    defineElement,
    processPlaceholders,
    createFragment
} = await import(`../base/base.js?path=${encodeURIComponent(componentPath)}`);

// class MarkerDataEvent extends Event {
//   constructor(eventName, lat, lng, address) {
//     super(eventName, { bubbles: true, composed: true });
//     this.lat = lat;
//     this.lng = lng;
//     this.address = address;
//   }
// }

export default class LocationInput extends Base {
    constructor() {
        super();

        this.querySelectorAll('.geo-locate').forEach(button => {
            button.addEventListener('click', () => {
                // this.handleClientLocation();
                requestClientLocation().then(coords => {
                    this.querySelector('#map-wrapper').setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    this.querySelector('map-picker')?.setAttribute('marker-coordinates', `${coords.lat},${coords.lng}`);
                    // document.dispatchEvent(new MarkerDataEvent('map-picker-confirm', coords.lat, coords.lng, null));
                }).catch(error => console.error(error) );
            });
        });
    }

    async render() {
        return await getHtml('location-input.html');
    }

    // afterRender() {
    // }

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