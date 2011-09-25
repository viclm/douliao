(function (window, document, undefined) {
    var container, prev, next;
    container = document.querySelector('div.paginator');
    if (container) {
        prev = container.querySelector('span.prev a');
        next = container.querySelector('span.next a');

        document.body.addEventListener('keyup', function (e) {
            var box, evt;
            evt = document.createEvent("MouseEvents");
            if (e.keyCode === 37 && prev) {
                box = prev.getBoundingClientRect();
                evt.initMouseEvent("click", true, true, window, 1, 0, 0, box.left + document.body.scrollLeft, box.top + document.body.scrollTop, false, false, false, false, 0, null);
                prev.dispatchEvent(evt);
            }
            else if (e.keyCode === 39 && next) {
                box = next.getBoundingClientRect();
                evt.initMouseEvent("click", true, true, window, 1, 0, 0, box.left + document.body.scrollLeft, box.top + document.body.scrollTop, false, false, false, false, 0, null);
                next.dispatchEvent(evt);
            }
        }, false);
    }
})(this, this.document);
