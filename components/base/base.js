function processPlaceholders(content) {
    // Regular expression to match script tags
    const scriptTagRegex = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

    // Match all script tags and replace them with placeholders
    const scripts = [];
    let modifiedContent = content.replace(scriptTagRegex, (match) => {
        scripts.push(match); // Store the script tag
        return `<!--SCRIPT_PLACEHOLDER_${scripts.length - 1}-->`; // Replace with placeholder
    });

    // Existing logic to process content
    // ...
    // Example: modifiedContent = modifiedContent.replace(/some_pattern/, 'replacement');

    // Restore script tags
    scripts.forEach((script, index) => {
        modifiedContent = modifiedContent.replace(`<!--SCRIPT_PLACEHOLDER_${index}-->`, script);
    });

    return modifiedContent;
}