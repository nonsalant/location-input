// Default location event handlers 
// can be overridden via Object.assign(LocationInput.prototype, locationHandlers);
// before defining the element with customElements.define('location-input', LocationInput);
// note: import the class like this so it's not auto-defined: import LocationInput from './components/location-input/location-input.js?define=false';
export const defaultLocationHandlers = {
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
};
