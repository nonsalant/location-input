const componentPath = import.meta.resolve('./');
const {
    Base,
    getHtml,
    defineElement,
} = await import(`../base/base.js?path=${encodeURIComponent(componentPath)}`);

export default class WcFoo extends Base {
    // static styles = ['wc-foo.css'];
    async render() {
        return await getHtml('wc-foo.html');
    }
    static {
       defineElement(new URL(import.meta.url).searchParams.get('define'), this);
    }
}