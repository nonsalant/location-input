# location-input

## Applying handler methods for `location-confirm` and `location-reset` events
The `location-input` web component fires custom events `location-confirm` and `location-reset` when the user confirms a location or resets the input, respectively.
By default, the component includes basic implementations for these event handlers (injecting the location in <output> element). However, you can override these handlers in two ways:

1. **Override via Object.assign**: After importing the `LocationInput` class but before defining the custom element, you can use `Object.assign` to add your own handler methods to the prototype.

```js
import LocationInput from './components/location-input/location-input.js?define=false';
const locationHandlers = {
    handleLocationConfirm(e) {
        // Your custom implementation for location-confirm
        console.log(`[${e.lat}, ${e.lng}]: ${e.address}`);
    },
    handleLocationReset() {
        // Your custom implementation for location-reset
        console.clear();
    },
};
Object.assign(LocationInput.prototype, locationHandlers);
customElements.define('location-input', LocationInput);
```

2. **Define handler methods directly in the class**: You can also define the handler methods directly within the `LocationInput` class itself by overriding the default implementations.

```js
export default class LocationInput extends Base {
    // ... other class code ...
    handleLocationConfirm(e) {
        // Your custom implementation for location-confirm
        console.log(`[${e.lat}, ${e.lng}]: ${e.address}`);
    }
    handleLocationReset() {
        // Your custom implementation for location-reset
        console.clear();
    }
    // ... other class code ...
}
```


The code below is deprecated because we're applying handler methods in the class:
```js
const locationInput = document.querySelector('location-input');

// Log + inject coordinates and address when 'location-confirm' custom event is fired
locationInput.addEventListener('location-confirm', async (e) => {
	console.log(`[${e.lat}, ${e.lng}]: ${e.address}`);
	const root = locationInput.shadowRoot ?? locationInput; // works in shadowRoot too
	const outputEl = root.querySelector('output');
	outputEl.innerHTML = `<ul>
				<li>latitude: ${e.lat}</li>
				<li>longitude: ${e.lng}</li>
				<li>address: ${e.address}</li>
		</ul>`;
});

// Clear the <output> element when the 'location-reset' custom event is fired
locationInput.addEventListener('location-reset', () => {
	const root = locationInput.shadowRoot ?? locationInput; // works in shadowRoot too
	const outputEl = root.querySelector('output');
	outputEl.innerText = '';
});
```


## Using shadow DOM instead of light DOM
The `location-input` component can be used with or without shadow DOM. By default, it uses light DOM. 

To enable shadow DOM, you will have to set the `enableShadowRoot` static property to `true` inside the class definition (location-input.js): 
```js
export default class LocationInput extends Base {
    static enableShadowRoot = true;
    // ... other class code ...
}
```

## Bringing all the HTML markup into one place
By default the `<location-input>` component loads its HTML markup from an external file (location-input/location-input.html). And this file in turn loads the contents of the `#map-wrapper` modal from an external file (map-picker/map-picker.html).

If the `<location-input>` component has the `#location-wrapper` and `#map-wrapper` markup already in its shadow DOM or light DOM, it will use that instead of loading the external location-input/location-input.html.

If you remove the `inner-content` attribute from the `#map-wrapper` `<lazy-modal>` element, the modal will not load the external map-picker/map-picker.html file, and you can put the modal contents directly inside the `<lazy-modal>` element instead of having them loaded from map-picker/map-picker.html.