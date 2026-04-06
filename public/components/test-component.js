class TestComponent extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = "Test element"
    };
}

customElements.define('test-component', TestComponent);