// demo implementation

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
