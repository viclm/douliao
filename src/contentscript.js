(function (window, document, undefined) {
    if (location.href.indexOf('http') === 0) {
        var container = document.querySelector('#profile .user-opt'), button, dchat;

        if (container === null) {return;}

        button = container.querySelector('a.mr5').cloneNode(false);
        button.innerHTML = '豆聊';
        button.style.marginLeft = '5px';
        container.insertBefore(button, document.getElementById('divac'));
        button.addEventListener('click', function (e) {
            e.preventDefault();
            chrome.extension.sendRequest({
                cmd: 'createWindow',
                people: location.href.match(/\/([^\/]+)\/?$/)[1],
                name: document.title.trim(),
                icon: document.querySelector('#db-usr-profile img').src,
                sign: document.querySelector('h1 span') ? document.querySelector('h1 span').innerHTML.replace(/^\(|\)$/g, '') : ''
            });
        }, false);

    }
})(this, this.document);

