
const componentPath = import.meta.resolve('./');
const {
    Base,
    getHtml,
    defineElement,
} = await import(`../base/base.js?path=${encodeURIComponent(componentPath)}`);

export default class WcBar extends Base {
    static styles = ['wc-bar.css'];
    async render() {
        return await getHtml('wc-bar.html');
    }
    static {
        defineElement(new URL(import.meta.url).searchParams.get('define'), this);
    }
}