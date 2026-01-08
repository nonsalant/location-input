// Default location event handlers 
// can be overridden via Object.assign(LocationInput.prototype, locationHandlers);
// before defining the element with customElements.define('location-input', LocationInput);
// note: import the class like this so it's not auto-defined: import LocationInput from './components/location-input/location-input.js?define=false';
export const defaultLocationHandlers = {
    // Log + inject coordinates + address when 'location-confirm' custom event is fired
    handleLocationConfirm(e) {
        console.log(`[${e.lat}, ${e.lng}]: ${e.address}`);
        const outputEl = this.domRoot.querySelector('output');
        outputEl.innerHTML = `<ul>
            <li>Latitude: ${e.lat}</li>
            <li>Longitude: ${e.lng}</li>
            <li>Address: ${e.address}</li>
        </ul>`;
    },

    // Clear the <output> element when the 'location-reset' custom event is fired
    handleLocationReset() {
        const outputEl = this.domRoot.querySelector('output');
        outputEl.innerText = '';
    }
};
